"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import QrModal from "@/components/QrModal";

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

export default function DashboardPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ insumos: 0, solicitudes: 0, viajes: 0, viajesActivos: 0 });
  const [qrData, setQrData] = useState<{ url: string; code: string; actorName: string } | null>(null);
  const [qError, setQError] = useState("");
  const [recentSupplies, setRecentSupplies] = useState<any[]>([]);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [recentShipments, setRecentShipments] = useState<any[]>([]);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    const storedActorObj = JSON.parse(localStorage.getItem("actor") || "{}");
    setActor(storedActorObj);

    setLoading(true);
    Promise.all([
      fetch("/api/insumos", { headers }).then((r) => r.json()).catch(() => []),
      fetch("/api/solicitudes", { headers }).then((r) => r.json()).catch(() => []),
      fetch("/api/viajes", { headers }).then((r) => r.json()).catch(() => []),
    ])
      .then(([ins, sol, via]) => {
        const suppliesArr = Array.isArray(ins) ? ins : [];
        const requestsArr = Array.isArray(sol) ? sol : [];
        const shipmentsArr = Array.isArray(via) ? via : [];

        setStats({
          insumos: suppliesArr.length,
          solicitudes: requestsArr.length,
          viajes: shipmentsArr.length,
          viajesActivos: shipmentsArr.filter((v: any) => v.estado === "in_transit" || v.estado === "assigned").length,
        });

        // Slice for latest feeds (limit 5)
        setRecentSupplies(suppliesArr.slice(0, 5));
        setRecentRequests(requestsArr.slice(0, 5));
        setRecentShipments(shipmentsArr.slice(0, 5));
      })
      .catch((e) => console.error("Error loading dashboard data", e))
      .finally(() => setLoading(false));
  }, [token, router]);

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
          <h2>¡Hola, {actor.name || "Usuario"}! 👋</h2>
          <p className="subtitle">
            {LABELS[actor.type] || "Portal de Logística"} &bull; Panel de Control Operativo
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {actor.type === "warehouse" && <a href="/insumos" className="btn btn-primary">Gestionar Insumos</a>}
            {actor.type === "relief" && <a href="/solicitudes" className="btn btn-primary">Crear Solicitud</a>}
            {actor.type === "transporter" && <a href="/viajes" className="btn btn-primary">Ver Viajes</a>}
            {actor.isOwner && ["warehouse", "relief"].includes(actor.type) && (
              <>
                <button className="btn btn-secondary" onClick={generateQr}>+ Afiliar Personal</button>
                <a href="/afiliados" className="btn btn-secondary">Gestionar Afiliados</a>
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
              <div className="dashboard-stat-card">
                <div className="dashboard-stat-info">
                  <span className="dashboard-stat-title">Mis Insumos</span>
                  <span className="dashboard-stat-value">{stats.insumos}</span>
                </div>
                <div className="dashboard-stat-icon">📦</div>
              </div>

              <div className="dashboard-stat-card">
                <div className="dashboard-stat-info">
                  <span className="dashboard-stat-title">Mis Solicitudes</span>
                  <span className="dashboard-stat-value">{stats.solicitudes}</span>
                </div>
                <div className="dashboard-stat-icon">📋</div>
              </div>

              <div className="dashboard-stat-card">
                <div className="dashboard-stat-info">
                  <span className="dashboard-stat-title">Viajes Totales</span>
                  <span className="dashboard-stat-value">{stats.viajes}</span>
                </div>
                <div className="dashboard-stat-icon">🚚</div>
              </div>

              <div className="dashboard-stat-card">
                <div className="dashboard-stat-info">
                  <span className="dashboard-stat-title">Viajes Activos</span>
                  <span className="dashboard-stat-value" style={{ color: "#2563eb" }}>{stats.viajesActivos}</span>
                </div>
                <div className="dashboard-stat-icon" style={{ background: "#eff6ff" }}>⚡</div>
              </div>
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
                          <div className="dashboard-action-icon">➕</div>
                          <div className="dashboard-action-title">Añadir Inventario</div>
                          <div className="dashboard-action-desc">Registra nuevos insumos y recursos disponibles en tu almacén.</div>
                        </Link>
                        <Link href="/matching" className="dashboard-action-card">
                          <div className="dashboard-action-icon">🤝</div>
                          <div className="dashboard-action-title">Ver Matches</div>
                          <div className="dashboard-action-desc">Sincroniza tus insumos disponibles con solicitudes abiertas.</div>
                        </Link>
                      </>
                    )}

                    {actor.type === "relief" && (
                      <>
                        <Link href="/solicitudes" className="dashboard-action-card">
                          <div className="dashboard-action-icon">🚨</div>
                          <div className="dashboard-action-title">Nueva Solicitud</div>
                          <div className="dashboard-action-desc">Crea y publica un pedido de insumos críticos para tu comunidad.</div>
                        </Link>
                        <Link href="/viajes" className="dashboard-action-card">
                          <div className="dashboard-action-icon">📦</div>
                          <div className="dashboard-action-title">Monitorear Envíos</div>
                          <div className="dashboard-action-desc">Revisa el estado de los vehículos que transportan tu ayuda.</div>
                        </Link>
                      </>
                    )}

                    {actor.type === "transporter" && (
                      <>
                        <Link href="/viajes" className="dashboard-action-card">
                          <div className="dashboard-action-icon">🗺️</div>
                          <div className="dashboard-action-title">Explorar Viajes</div>
                          <div className="dashboard-action-desc">Encuentra y acepta cargas de ayuda humanitaria pendientes.</div>
                        </Link>
                        <Link href="/" className="dashboard-action-card">
                          <div className="dashboard-action-icon">🌐</div>
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
                            <span className="feed-item-sub">Requerido: {req.quantity} {req.unit}</span>
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
    </div>
  );
}
