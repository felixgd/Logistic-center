"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import QrModal from "@/components/QrModal";
import { useApi, invalidateCache } from "@/lib/swr";
import { getAuthHeaders, setCsrfToken } from "@/lib/api-client";
import { 
  Package, 
  ClipboardText, 
  Truck, 
  CheckCircle,
  Warning,
  PencilSimple,
  Plus,
  ArrowSquareOut,
  MapPin,
  Globe,
  Handshake,
  Compass,
  Layout,
  Scales,
  ArrowsClockwise
} from "@phosphor-icons/react";

// Dynamically import the map component with SSR disabled
const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => <p style={{ color: "#64748b", padding: 16 }}>Cargando mini-mapa...</p>,
});

  const LABELS: Record<string, string> = {
  warehouse: "Almacén / Centro de Acopio",
  relief: "Centro de Ayuda Humanitaria",
  transporter: "Transportista / Conductor",
};

  const PROFILE_TYPES = [
    { value: "warehouse", label: "Almacén / Centro de Acopio" },
    { value: "relief", label: "Centro de Ayuda Humanitaria" },
    { value: "transporter", label: "Transportista / Conductor" },
  ];

export default function DashboardPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    insumos: 0, 
    solicitudes: 0, 
    solicitudesAbiertas: 0,
    solicitudesAbiertasGlobal: 0,
    viajes: 0, 
    viajesActivos: 0,
    viajesCompletados: 0 
  });
  const [qrData, setQrData] = useState<{ url: string; code: string; actorName: string } | null>(null);
  const [qError, setQError] = useState("");
  const [recentSupplies, setRecentSupplies] = useState<any[]>([]);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [recentShipments, setRecentShipments] = useState<any[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    vehicleType: "",
    capacityKg: ""
  });
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
  const [newProfileForm, setNewProfileForm] = useState({
    type: "warehouse",
    name: "",
    contactName: "",
    phone: "",
    whatsapp: "",
    address: "",
    city: "",
    lat: null as number | null,
    lng: null as number | null,
    vehicleType: "",
    capacityKg: ""
  });
  const [createProfileError, setCreateProfileError] = useState("");
  const [createProfileSaving, setCreateProfileSaving] = useState(false);
  const [userActors, setUserActors] = useState<any[]>([]);


  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = token ? getAuthHeaders() : {};

  const { data: insumosData, error: insumosError } = useApi<any[]>(token ? "/api/insumos" : null);
  const { data: solicitudesData, error: solicitudesError } = useApi<any[]>(token ? "/api/solicitudes" : null);
  const { data: viajesData, error: viajesError } = useApi<any[]>(token ? "/api/viajes" : null);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }
    const storedActorObj = JSON.parse(localStorage.getItem("actor") || "{}");
    setActor(storedActorObj);

    // Cargar datos completos del perfil (vehículo, capacidad, ubicación, etc.)
    fetch("/api/actores/perfil", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const mergedActor = { ...storedActorObj, ...data };
        localStorage.setItem("actor", JSON.stringify(mergedActor));
        setActor(mergedActor);
      })
      .catch((err) => console.error("Error cargando perfil completo:", err));

    // Cargar lista de perfiles del usuario para ocultar tipos ya creados
    fetch("/api/actores/list", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUserActors(data);
        }
      })
      .catch((err) => console.error("Error cargando lista de actores:", err));
  }, [token, router]);

  // Asegurar que el tipo seleccionado en el modal de crear perfil siempre sea válido
  useEffect(() => {
    setNewProfileForm((prev) => {
      const createdTypes = new Set(userActors.filter((a) => a.isOwner).map((a) => a.type));
      const availableTypes = PROFILE_TYPES.filter((t) => !createdTypes.has(t.value));
      if (availableTypes.length > 0 && !availableTypes.some((t) => t.value === prev.type)) {
        return { ...prev, type: availableTypes[0].value };
      }
      return prev;
    });
  }, [userActors]);

  useEffect(() => {
    const suppliesArr = Array.isArray(insumosData) ? insumosData : [];
    const requestsArr = Array.isArray(solicitudesData) ? solicitudesData : [];
    const shipmentsArr = Array.isArray(viajesData) ? viajesData : [];

    setStats({
      insumos: suppliesArr.length,
      solicitudes: requestsArr.length,
      solicitudesAbiertas: requestsArr.filter((r: any) => r.status === "open").length,
      solicitudesAbiertasGlobal: requestsArr.filter((r: any) => r.status === "open").length,
      viajes: shipmentsArr.length,
      viajesActivos: shipmentsArr.filter((v: any) => v.estado === "in_transit" || v.estado === "assigned").length,
      viajesCompletados: shipmentsArr.filter((v: any) => v.estado === "completed").length,
    });

    setRecentSupplies(suppliesArr.slice(0, 5));
    setRecentRequests(requestsArr.slice(0, 5));
    setRecentShipments(shipmentsArr.slice(0, 5));
    setLoading(false);
  }, [insumosData, solicitudesData, viajesData]);

  useEffect(() => {
    if (actor) {
      setProfileForm({
        name: actor.name || "",
        vehicleType: actor.vehicleType || "",
        capacityKg: actor.capacityKg ? String(actor.capacityKg) : ""
      });
    }
  }, [actor]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("create_profile") === "true") {
        setShowCreateProfileModal(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!showCreateProfileModal || !token) return;
    fetch("/api/actores/perfil", { headers })
      .then((r) => r.json())
      .then((data) => {
        const phone = data.phone || data.whatsapp || data.userPhone || "";
        const whatsapp = data.whatsapp || data.phone || data.userPhone || "";
        setNewProfileForm((prev) => ({
          ...prev,
          contactName: data.contactName || data.name || "",
          phone,
          whatsapp,
          address: data.address || "",
          city: data.city || "",
          vehicleType: data.vehicleType || "",
          capacityKg: data.capacityKg ? String(data.capacityKg) : ""
        }));
      })
      .catch((err) => console.error("Error cargando perfil para nuevo actor:", err));
  }, [showCreateProfileModal, token, headers]);

  const generateQr = async () => {
    setQError("");
    try {
      const res = await fetch("/api/actores/afiliar/codigo", { method: "POST", headers });
      const data = await res.json();
      if (!res.ok) { setQError(data.error); return; }
      setQrData(data);
    } catch {
      setQError("Error al generar código");
    }
  };

  if (!token) return null;

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case "alta":
      case "urgente":
      case "crítica":
      case "critica":
        return <span className="badge badge-critica" style={{ animation: "none" }}>{urgency}</span>;
      case "media":
        return <span className="badge badge-pendiente">{urgency}</span>;
      default:
        return <span className="badge" style={{ background: "#cbd5e1" }}>{urgency}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "open":
      case "available":
        return <span className="badge badge-completado">Activo</span>;
      case "in_progress":
      case "assigned":
      case "in_transit":
        return <span className="badge badge-proceso">En Progreso</span>;
      default:
        return <span className="badge badge-cancelado">{status}</span>;
    }
  };

  return (
    <div>
      <Navbar />
      <div className="container" style={{ paddingBottom: "40px" }}>
        {/* Header Greeting */}
        <div className="dashboard-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <h2 style={{ margin: 0 }}>¡Hola, {actor.name || "Usuario"}!</h2>
            <button 
              onClick={() => setShowProfileModal(true)} 
              className="btn btn-secondary" 
              style={{ padding: "4px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}
            >
              <PencilSimple size={12} weight="bold" />
              Editar Perfil
            </button>
            <button 
              onClick={() => setShowCreateProfileModal(true)} 
              className="btn btn-success" 
              style={{ padding: "4px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={12} weight="bold" />
              Crear Perfil
            </button>
          </div>
          <p className="subtitle" style={{ marginTop: 4 }}>
            {LABELS[actor.type] || "Portal de Logística"} &bull; Panel de Control Operativo
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {actor.type === "warehouse" && <a href="/insumos" className="btn btn-primary">Gestionar Insumos</a>}
            {actor.type === "relief" && <a href="/solicitudes" className="btn btn-primary">Crear Solicitud</a>}
            {actor.type === "transporter" && <a href="/viajes" className="btn btn-primary">Ver Viajes</a>}
            {actor.isOwner && ["warehouse", "relief"].includes(actor.type) && (
              <>
                <button className="btn btn-secondary" onClick={generateQr}>+ Afiliar Personal</button>
                <a href="/afiliados" className="btn btn-secondary">Gestionar Voluntarios</a>
              </>
            )}
          </div>
          {qError && <p style={{ color: "#dc2626", marginTop: 8, fontSize: 13 }}>{qError}</p>}
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b", marginTop: 40, fontSize: 16 }}>Cargando información del dashboard...</p>
        ) : (
          <>
            {/* Visual Metric Grid */}
            <div className="dashboard-grid">
              {actor.type === "warehouse" && (
                <>
                  <Link href="/insumos" className="dashboard-stat-card" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Insumos en Almacén</span>
                      <span className="dashboard-stat-value">{stats.insumos}</span>
                    </div>
                    <div className="dashboard-stat-icon" style={{ color: "#64748b", background: "#f8fafc" }}>
                      <Package size={24} />
                    </div>
                  </Link>
                  <Link href="/matching" className="dashboard-stat-card" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Solicitudes Abiertas (Global)</span>
                      <span className="dashboard-stat-value">{stats.solicitudesAbiertasGlobal}</span>
                    </div>
                    <div className="dashboard-stat-icon" style={{ color: "#64748b", background: "#f8fafc" }}>
                      <ClipboardText size={24} />
                    </div>
                  </Link>
                  <Link href="/viajes" className="dashboard-stat-card" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Envíos Totales</span>
                      <span className="dashboard-stat-value">{stats.viajes}</span>
                    </div>
                    <div className="dashboard-stat-icon" style={{ color: "#64748b", background: "#f8fafc" }}>
                      <Truck size={24} />
                    </div>
                  </Link>
                  <Link href="/viajes" className="dashboard-stat-card" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Envíos en Tránsito</span>
                      <span className="dashboard-stat-value" style={{ color: "#2563eb" }}>{stats.viajesActivos}</span>
                    </div>
                    <div className="dashboard-stat-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
                      <ArrowsClockwise size={24} />
                    </div>
                  </Link>
                </>
              )}

              {actor.type === "relief" && (
                <>
                  <Link href="/solicitudes" className="dashboard-stat-card" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Mis Solicitudes</span>
                      <span className="dashboard-stat-value">{stats.solicitudes}</span>
                    </div>
                    <div className="dashboard-stat-icon" style={{ color: "#64748b", background: "#f8fafc" }}>
                      <ClipboardText size={24} />
                    </div>
                  </Link>
                  <Link href="/solicitudes" className="dashboard-stat-card" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Solicitudes Abiertas</span>
                      <span className="dashboard-stat-value" style={{ color: "#ef4444" }}>{stats.solicitudesAbiertas}</span>
                    </div>
                    <div className="dashboard-stat-icon" style={{ background: "#fef2f2", color: "#ef4444" }}>
                      <Warning size={24} />
                    </div>
                  </Link>
                  <Link href="/viajes" className="dashboard-stat-card" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Envíos en Camino</span>
                      <span className="dashboard-stat-value" style={{ color: "#f59e0b" }}>{stats.viajesActivos}</span>
                    </div>
                    <div className="dashboard-stat-icon" style={{ background: "#fffbeb", color: "#f59e0b" }}>
                      <Truck size={24} />
                    </div>
                  </Link>
                  <Link href="/viajes" className="dashboard-stat-card" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Envíos Recibidos</span>
                      <span className="dashboard-stat-value" style={{ color: "#10b981" }}>{stats.viajesCompletados}</span>
                    </div>
                    <div className="dashboard-stat-icon" style={{ background: "#ecfdf5", color: "#10b981" }}>
                      <CheckCircle size={24} />
                    </div>
                  </Link>
                </>
              )}

              {actor.type === "transporter" && (
                <>
                  <Link href="/viajes" className="dashboard-stat-card" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Viajes Asignados</span>
                      <span className="dashboard-stat-value">{stats.viajes}</span>
                    </div>
                    <div className="dashboard-stat-icon" style={{ color: "#64748b", background: "#f8fafc" }}>
                      <Compass size={24} />
                    </div>
                  </Link>
                  <Link href="/viajes" className="dashboard-stat-card" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Viajes en Tránsito</span>
                      <span className="dashboard-stat-value" style={{ color: "#2563eb" }}>{stats.viajesActivos}</span>
                    </div>
                    <div className="dashboard-stat-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
                      <Truck size={24} />
                    </div>
                  </Link>
                  <div className="dashboard-stat-card" onClick={() => setShowProfileModal(true)} style={{ cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Vehículo</span>
                      {actor.vehicleType ? (
                        <span className="dashboard-stat-value" style={{ fontSize: 16 }}>{actor.vehicleType}</span>
                      ) : (
                        <span className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 11, marginTop: 4, width: "fit-content", display: "inline-block" }}>
                          Registrar
                        </span>
                      )}
                    </div>
                    <div className="dashboard-stat-icon" style={{ color: "#64748b", background: "#f8fafc" }}>
                      <Truck size={24} />
                    </div>
                  </div>
                  <div className="dashboard-stat-card" onClick={() => setShowProfileModal(true)} style={{ cursor: "pointer" }}>
                    <div className="dashboard-stat-info">
                      <span className="dashboard-stat-title">Capacidad Carga</span>
                      {actor.capacityKg ? (
                        <span className="dashboard-stat-value" style={{ fontSize: 16 }}>{actor.capacityKg} kg</span>
                      ) : (
                        <span className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 11, marginTop: 4, width: "fit-content", display: "inline-block" }}>
                          Registrar
                        </span>
                      )}
                    </div>
                    <div className="dashboard-stat-icon" style={{ color: "#64748b", background: "#f8fafc" }}>
                      <Scales size={24} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Double Column Layout */}
            <div className="dashboard-columns">
              {/* Left Column: Actions & Location Map */}
              <div className="dashboard-left-col">
                <div className="card" style={{ padding: "24px" }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>
                    Acciones Rápidas
                  </h3>
                  
                  {/* Role-Specific Quick Actions Grid */}
                  <div className="dashboard-action-grid">
                    {actor.type === "warehouse" && (
                      <>
                        <Link href="/insumos" className="dashboard-action-card">
                          <div className="dashboard-action-icon" style={{ color: "#0f172a" }}>
                            <Plus size={20} weight="bold" />
                          </div>
                          <div className="dashboard-action-title">Añadir Inventario</div>
                          <div className="dashboard-action-desc">Registra nuevos insumos y recursos disponibles en tu almacén.</div>
                        </Link>
                        <Link href="/matching" className="dashboard-action-card">
                          <div className="dashboard-action-icon" style={{ color: "#0f172a" }}>
                            <Handshake size={20} />
                          </div>
                          <div className="dashboard-action-title">Ver Coordinaciones</div>
                          <div className="dashboard-action-desc">Sincroniza tus insumos disponibles con solicitudes abiertas.</div>
                        </Link>
                      </>
                    )}

                    {actor.type === "relief" && (
                      <>
                        <Link href="/solicitudes" className="dashboard-action-card">
                          <div className="dashboard-action-icon" style={{ color: "#dc2626" }}>
                            <Plus size={20} weight="bold" />
                          </div>
                          <div className="dashboard-action-title">Nueva Solicitud</div>
                          <div className="dashboard-action-desc">Crea y publica un pedido de insumos críticos para tu comunidad.</div>
                        </Link>
                        <Link href="/viajes" className="dashboard-action-card">
                          <div className="dashboard-action-icon" style={{ color: "#0f172a" }}>
                            <Package size={20} />
                          </div>
                          <div className="dashboard-action-title">Monitorear Envíos</div>
                          <div className="dashboard-action-desc">Revisa el estado de los vehículos que transportan tu ayuda.</div>
                        </Link>
                      </>
                    )}

                    {actor.type === "transporter" && (
                      <>
                        <Link href="/viajes" className="dashboard-action-card">
                          <div className="dashboard-action-icon" style={{ color: "#0f172a" }}>
                            <Compass size={20} />
                          </div>
                          <div className="dashboard-action-title">Explorar Viajes</div>
                          <div className="dashboard-action-desc">Encuentra y acepta cargas de ayuda humanitaria pendientes.</div>
                        </Link>
                        <Link href="/" className="dashboard-action-card">
                          <div className="dashboard-action-icon" style={{ color: "#0f172a" }}>
                            <Globe size={20} />
                          </div>
                          <div className="dashboard-action-title">Ver Mapa Central</div>
                          <div className="dashboard-action-desc">Consulta el mapa central para ver rutas y otros conductores.</div>
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                {/* Localized Mini-Map */}
                {actor.lat && actor.lng && (
                  <div className="dashboard-map-panel">
                    <h3>Ubicación Registrada de tus Operaciones</h3>
                    <div className="dashboard-map-wrapper" style={{ height: "240px" }}>
                      <MapComponent
                        containerId="dashboard-mini-map"
                        actors={[{
                          id: actor.id,
                          name: actor.name,
                          type: actor.type,
                          address: actor.address || "Mi ubicación",
                          city: actor.city || "",
                          lat: actor.lat,
                          lng: actor.lng
                        }]}
                        initialLat={actor.lat}
                        initialLng={actor.lng}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Live Operation Feed */}
              <div className="dashboard-feed-card">
                <h3>Actividad Reciente</h3>

                {/* Warehouse Feed */}
                {actor.type === "warehouse" && (
                  <div>
                    <h4 style={{ fontSize: 13, textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>Insumos Recientes</h4>
                    {recentSupplies.length === 0 ? (
                      <p style={{ color: "#9ca3af", fontSize: 13, padding: "8px 0" }}>No hay insumos registrados en inventario.</p>
                    ) : (
                      recentSupplies.map((item) => (
                        <div key={item.id} className="feed-item">
                          <div className="feed-item-left">
                            <span className="feed-item-name">{item.name}</span>
                            <span className="feed-item-sub">Cantidad: {item.quantity} {item.unit}</span>
                          </div>
                          {getStatusBadge(item.status)}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Relief Center Feed */}
                {actor.type === "relief" && (
                  <div>
                    <h4 style={{ fontSize: 13, textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>Solicitudes de Ayuda</h4>
                    {recentRequests.length === 0 ? (
                      <p style={{ color: "#9ca3af", fontSize: 13, padding: "8px 0" }}>No has publicado ninguna solicitud.</p>
                    ) : (
                      recentRequests.map((req) => (
                        <div key={req.id} className="feed-item">
                          <div className="feed-item-left">
                            <span className="feed-item-name">{req.name}</span>
                            <span className="feed-item-sub">Requerido: {req.quantityOriginal || req.quantity} {req.unit} ({req.quantityFulfilled || 0} entregados)</span>
                          </div>
                          {getUrgencyBadge(req.urgency)}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Transporter Feed */}
                {actor.type === "transporter" && (
                  <div>
                    <h4 style={{ fontSize: 13, textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>Tus Cargas / Envíos Asignados</h4>
                    {recentShipments.length === 0 ? (
                      <p style={{ color: "#9ca3af", fontSize: 13, padding: "8px 0" }}>No tienes viajes asignados en este momento.</p>
                    ) : (
                      recentShipments.map((ship) => (
                        <div key={ship.id} className="feed-item">
                          <div className="feed-item-left">
                            <span className="feed-item-name">Código: {ship.codigoViaje}</span>
                            <span className="feed-item-sub">Destino: {ship.centroAyuda?.name || "Desconocido"}</span>
                          </div>
                          {getStatusBadge(ship.estado)}
                        </div>
                      ))
                    )}
                  </div>
                )}
                
                {/* Unified Recent Shipments List (Common view) */}
                {recentShipments.length > 0 && actor.type !== "transporter" && (
                  <div style={{ marginTop: 24, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
                    <h4 style={{ fontSize: 13, textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>Envíos en Curso</h4>
                    {recentShipments.map((ship) => (
                      <div key={ship.id} className="feed-item">
                        <div className="feed-item-left">
                          <span className="feed-item-name">Envío: {ship.codigoViaje}</span>
                          <span className="feed-item-sub">
                            {actor.type === "warehouse" ? `Hacia: ${ship.centroAyuda?.name}` : `Desde: ${ship.almacen?.name}`}
                          </span>
                        </div>
                        {getStatusBadge(ship.estado)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {qrData && <QrModal url={qrData.url} actorName={qrData.actorName} code={qrData.code} onClose={() => setQrData(null)} />}
      {showProfileModal && (
        <div className="modal-backdrop" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div className="card" style={{
            width: "90%",
            maxWidth: "450px",
            padding: "24px",
            borderRadius: "12px",
            backgroundColor: "#fff",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>
              Actualizar Perfil
            </h3>
            {profileError && (
              <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{profileError}</p>
            )}
            <form onSubmit={async (e) => {
              e.preventDefault();
              setProfileError("");
              setProfileSaving(true);
              try {
                const res = await fetch("/api/actores/perfil", {
                  method: "PUT",
                  headers: getAuthHeaders(),
                  body: JSON.stringify(profileForm)
                });
                const data = await res.json();
                if (!res.ok) {
                  setProfileError(data.error || "Error al actualizar el perfil");
                  setProfileSaving(false);
                  return;
                }
                const updatedActor = { ...actor, ...data.actor };
                localStorage.setItem("actor", JSON.stringify(updatedActor));
                setActor(updatedActor);
                setShowProfileModal(false);
                window.location.reload();
              } catch (err) {
                setProfileError("Error de conexión al actualizar el perfil");
                setProfileSaving(false);
              }
            }}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                  Nombre
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: 14
                  }}
                />
              </div>

              {actor.type === "transporter" && (
                <>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                      Tipo de Vehículo
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Camión, Camioneta"
                      value={profileForm.vehicleType}
                      onChange={(e) => setProfileForm({ ...profileForm, vehicleType: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: 14
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                      Capacidad de Carga (kg)
                    </label>
                    <input
                      type="number"
                      placeholder="Ej. 1500"
                      value={profileForm.capacityKg}
                      onChange={(e) => setProfileForm({ ...profileForm, capacityKg: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: 14
                      }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowProfileModal(false)}
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={profileSaving}
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  {profileSaving ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showCreateProfileModal && (
        <div className="modal-backdrop" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div className="card" style={{
            width: "90%",
            maxWidth: "500px",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "24px",
            borderRadius: "12px",
            backgroundColor: "#fff",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>
              Crear Nuevo Perfil / Rol
            </h3>
            {createProfileError && (
              <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{createProfileError}</p>
            )}
            <form onSubmit={async (e) => {
              e.preventDefault();
              setCreateProfileError("");
              setCreateProfileSaving(true);
              try {
                const res = await fetch("/api/actores/create", {
                  method: "POST",
                  headers: getAuthHeaders(),
                  body: JSON.stringify(newProfileForm)
                });
                const data = await res.json();
                if (!res.ok) {
                  setCreateProfileError(data.error || "Error al crear el perfil");
                  setCreateProfileSaving(false);
                  return;
                }
                localStorage.setItem("token", data.token);
                if (data.csrfToken) setCsrfToken(data.csrfToken);
                localStorage.setItem("actor", JSON.stringify(data.actor));
                setShowCreateProfileModal(false);
                window.location.href = "/dashboard";
              } catch (err) {
                setCreateProfileError("Error de conexión al crear el perfil");
                setCreateProfileSaving(false);
              }
            }}>
              {(() => {
                const createdTypes = new Set(userActors.filter((a) => a.isOwner).map((a) => a.type));
                const availableTypes = PROFILE_TYPES.filter((t) => !createdTypes.has(t.value));
                return (
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                      Tipo de Perfil / Rol *
                    </label>
                    {availableTypes.length === 0 ? (
                      <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
                        Ya tienes creados los 3 perfiles disponibles.
                      </p>
                    ) : (
                      <select
                        value={newProfileForm.type}
                        onChange={(e) => setNewProfileForm({ ...newProfileForm, type: e.target.value })}
                        required
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: 14,
                          backgroundColor: "#fff"
                        }}
                      >
                        {availableTypes.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })()}

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                  Nombre del Perfil *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Almacén del Norte, Mi Camión"
                  value={newProfileForm.name}
                  onChange={(e) => setNewProfileForm({ ...newProfileForm, name: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: 14
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                  Persona de Contacto
                </label>
                <input
                  type="text"
                  value={newProfileForm.contactName}
                  readOnly
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#f1f5f9",
                    color: "#64748b",
                    fontSize: 14
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={newProfileForm.phone}
                    readOnly
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#f1f5f9",
                      color: "#64748b",
                      fontSize: 14
                    }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                    WhatsApp
                  </label>
                  <input
                    type="text"
                    value={newProfileForm.whatsapp}
                    readOnly
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#f1f5f9",
                      color: "#64748b",
                      fontSize: 14
                    }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                  📍 Ubicación en el mapa (haz clic para marcar)
                </label>
                <div style={{ height: "200px", borderRadius: "6px", overflow: "hidden", border: "1px solid #cbd5e1" }}>
                  <MapComponent
                    containerId="create-profile-map"
                    actors={[]}
                    interactive={true}
                    onLocationSelected={(lat, lng) => {
                      setNewProfileForm((prev) => ({ ...prev, lat, lng }));
                    }}
                    onAddressFound={(address, city) => {
                      setNewProfileForm((prev) => ({ ...prev, address, city }));
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={newProfileForm.address}
                    onChange={(e) => setNewProfileForm({ ...newProfileForm, address: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: 14
                    }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={newProfileForm.city}
                    onChange={(e) => setNewProfileForm({ ...newProfileForm, city: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: 14
                    }}
                  />
                </div>
              </div>

              {newProfileForm.type === "transporter" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div className="form-group">
                    <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                      Tipo de Vehículo
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Camión, Camioneta"
                      value={newProfileForm.vehicleType}
                      onChange={(e) => setNewProfileForm({ ...newProfileForm, vehicleType: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: 14
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13, color: "#475569" }}>
                      Capacidad Carga (kg)
                    </label>
                    <input
                      type="number"
                      placeholder="Ej. 1500"
                      value={newProfileForm.capacityKg}
                      onChange={(e) => setNewProfileForm({ ...newProfileForm, capacityKg: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: 14
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateProfileModal(false)}
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createProfileSaving}
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  {createProfileSaving ? "Creando..." : "Crear Perfil"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
