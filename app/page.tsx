"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

// Dynamically import the map component with SSR disabled
const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: "#f1f5f9" }}>
      <p style={{ color: "#64748b", fontWeight: 600 }}>Cargando mapa interactivo...</p>
    </div>
  ),
});

interface Actor {
  id: string;
  name: string;
  type: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  phone?: string | null;
  whatsapp?: string | null;
}

interface SupplyRequest {
  id: string;
  category: string;
  name: string;
  quantity: number;
  unit: string;
  urgency: string;
  status: string;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    city: string | null;
    lat: number | null;
    lng: number | null;
    whatsapp: string | null;
  };
}

interface Shipment {
  id: string;
  codigoViaje: string;
  almacen: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    whatsapp: string | null;
  };
  centroAyuda: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    whatsapp: string | null;
  };
  transportista: {
    id: string;
    name: string;
    whatsapp: string | null;
  } | null;
  insumos: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  estado: string;
  createdAt: string;
}

export default function HomePage() {
  const [data, setData] = useState<{ actors: Actor[]; recentRequests: SupplyRequest[]; recentShipments: Shipment[] }>({
    actors: [],
    recentRequests: [],
    recentShipments: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"requests" | "shipments">("requests");
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // Mobile bottom-sheet drag states
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth > 768) return;
    if ((e.target as HTMLElement).closest(".btn") || (e.target as HTMLElement).closest(".sidebar-expand-toggle")) return;
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    setDragOffsetY(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    setDragOffsetY(currentY - dragStartY.current);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const travelDistance = window.innerHeight * 0.75 - 182;
    const finalTranslation = sidebarOpen ? dragOffsetY : travelDistance + dragOffsetY;

    if (finalTranslation < travelDistance / 2) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
    setDragOffsetY(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (window.innerWidth > 768) return;
    if ((e.target as HTMLElement).closest(".btn") || (e.target as HTMLElement).closest(".sidebar-expand-toggle")) return;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    setDragOffsetY(0);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setDragOffsetY(moveEvent.clientY - dragStartY.current);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      
      const travelDistance = window.innerHeight * 0.75 - 182;
      const dy = upEvent.clientY - dragStartY.current;
      const finalTranslation = sidebarOpen ? dy : travelDistance + dy;

      if (finalTranslation < travelDistance / 2) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
      setDragOffsetY(0);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Modals state
  const [activeModal, setActiveModal] = useState<"request" | "supply" | "driver" | "claim" | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Common form fields (Pre-filled from localStorage)
  const [formName, setFormName] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formLat, setFormLat] = useState<number | null>(null);
  const [formLng, setFormLng] = useState<number | null>(null);

  // Request & Supply specific fields
  const [formCategory, setFormCategory] = useState("general");
  const [formItemName, setFormItemName] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formUnit, setFormUnit] = useState("unidades");
  const [formUrgency, setFormUrgency] = useState("media");
  const [formNotes, setFormNotes] = useState("");

  // Driver specific fields
  const [formVehicleType, setFormVehicleType] = useState("Camión");
  const [formCapacityKg, setFormCapacityKg] = useState("");

  // Claim Trip specific
  const [activeClaimShipmentId, setActiveClaimShipmentId] = useState<string | null>(null);

  const [availableActors, setAvailableActors] = useState<any[]>([]);
  const [actor, setActor] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/public/map-data");
      const json = await res.json();
      if (res.ok) {
        setData({
          actors: json.actors || [],
          recentRequests: json.recentRequests || [],
          recentShipments: json.recentShipments || [],
        });
      }
    } catch (err) {
      console.error("Error fetching map data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load identified actor from localStorage and start background polling
  useEffect(() => {
    setMounted(true);
    fetchData();

    // Poll the public map API silently every 10 seconds
    const intervalId = setInterval(() => {
      fetch("/api/public/map-data")
        .then((res) => res.json())
        .then((json) => {
          setData({
            actors: json.actors || [],
            recentRequests: json.recentRequests || [],
            recentShipments: json.recentShipments || [],
          });
        })
        .catch((err) => console.error("Error polling map data:", err));
    }, 10000);

    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true);
      fetch("/api/actores/list", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAvailableActors(data);
          }
        })
        .catch((e) => console.error("Error fetching available actors", e));
    }

    const storedActor = localStorage.getItem("actor");
    if (storedActor) {
      try {
        const actorObj = JSON.parse(storedActor);
        setActor(actorObj);
        setFormName(actorObj.name || "");
        setFormWhatsapp(actorObj.whatsapp || "");
      } catch (e) {
        console.error("Error parsing stored actor", e);
      }
    }

    return () => clearInterval(intervalId);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("actor");
    setIsAuthenticated(false);
    setFormName("");
    setFormWhatsapp("");
  };

  const handleCardClick = (actorId: string) => {
    setSelectedActorId(null);
    setTimeout(() => {
      setSelectedActorId(actorId);
    }, 50);
  };

  // Opens a modal and resets status
  const openModal = (type: "request" | "supply" | "driver") => {
    setSubmitError("");
    setSubmitSuccess("");
    // Keep name and whatsapp prefilled
    setFormItemName("");
    setFormQuantity("");
    setFormNotes("");
    setFormLat(null);
    setFormLng(null);
    setActiveModal(type);
  };

  const openClaimModal = (shipmentId: string) => {
    setSubmitError("");
    setSubmitSuccess("");
    setActiveClaimShipmentId(shipmentId);
    setActiveModal("claim");
  };

  // Submit request / supply / driver
  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formWhatsapp) {
      setSubmitError("Nombre y WhatsApp son obligatorios.");
      return;
    }

    try {
      setSubmitLoading(true);
      setSubmitError("");

      const payload = {
        action: activeModal,
        name: formName,
        whatsapp: formWhatsapp,
        address: formAddress || "Sin dirección",
        city: formCity || "Sin ciudad",
        lat: formLat,
        lng: formLng,
        category: formCategory,
        itemName: formItemName,
        quantity: Number(formQuantity),
        unit: formUnit,
        urgency: formUrgency,
        notes: formNotes,
        vehicleType: formVehicleType,
        capacityKg: Number(formCapacityKg) || 0,
      };

      const res = await fetch("/api/public/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || "Ocurrió un error.");
        return;
      }

      // Save credentials in browser
      localStorage.setItem("token", json.token);
      localStorage.setItem("actor", JSON.stringify(json.actor));

      setSubmitSuccess("¡Registro exitoso y publicado con éxito!");
      setTimeout(() => {
        setActiveModal(null);
        fetchData();
      }, 1500);
    } catch (err: any) {
      setSubmitError("Error de red al procesar la solicitud.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Claim proposed trip
  const handleClaimTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formWhatsapp) {
      setSubmitError("Nombre y WhatsApp son obligatorios.");
      return;
    }

    try {
      setSubmitLoading(true);
      setSubmitError("");

      const res = await fetch("/api/public/claim-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: activeClaimShipmentId,
          name: formName,
          whatsapp: formWhatsapp,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || "Ocurrió un error.");
        return;
      }

      setSubmitSuccess("¡Viaje asignado con éxito! Revisa tus mensajes de WhatsApp para coordinar.");
      setTimeout(() => {
        setActiveModal(null);
        fetchData();
      }, 2000);
    } catch (err) {
      setSubmitError("Error al reclamar el viaje.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const getUrgencyBadgeColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case "alta":
      case "urgente":
      case "crítica":
      case "critica":
        return "#fee2e2";
      case "media":
        return "#fef3c7";
      default:
        return "#f1f5f9";
    }
  };

  const getUrgencyTextColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case "alta":
      case "urgente":
      case "crítica":
      case "critica":
        return "#991b1b";
      case "media":
        return "#92400e";
      default:
        return "#475569";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case "open":
        return "Abierta";
      case "in_progress":
        return "En Camino";
      case "completed":
        return "Completada";
      default:
        return status;
    }
  };

  // Dynamic bottom sheet drag styles
  const travelDistance = typeof window !== "undefined" ? window.innerHeight * 0.75 - 182 : 0;
  const translation = isDragging
    ? (sidebarOpen 
        ? Math.max(0, Math.min(travelDistance, dragOffsetY))
        : Math.max(0, Math.min(travelDistance, travelDistance + dragOffsetY))
      )
    : null;

  const sidebarStyle: React.CSSProperties = translation !== null
    ? {
        transform: `translateY(${translation}px)`,
        transition: "none",
      }
    : {};

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden" }}>
      {/* Top Header Navigation */}
      <header className="main-header">
        <Link href="/" className="logo">
          <span>📦 Logística Central</span>
        </Link>
        <button className="header-hamburger" onClick={() => setHeaderMenuOpen(!headerMenuOpen)} aria-label="Menú">
          <span className={`hamburger-line ${headerMenuOpen ? "open" : ""}`} />
          <span className={`hamburger-line ${headerMenuOpen ? "open" : ""}`} />
          <span className={`hamburger-line ${headerMenuOpen ? "open" : ""}`} />
        </button>
        <nav className={`header-nav ${headerMenuOpen ? "open" : ""}`}>
          <Link href="/" className="active" onClick={() => setHeaderMenuOpen(false)}>Mapa Central</Link>
          {mounted && isAuthenticated && <Link href="/dashboard" onClick={() => setHeaderMenuOpen(false)}>Dashboard</Link>}
          <div className="header-nav-auth">
            {mounted && isAuthenticated ? (
              <>
                <span className="user-greeting">👋 Hola, <strong>{formName}</strong></span>
                {actor && availableActors.length > 0 && (
                  <select 
                    value={actor.id} 
                    onChange={async (e) => {
                      const targetActorId = e.target.value;
                      if (targetActorId === "create_new_profile") {
                        window.location.href = "/dashboard?create_profile=true";
                        return;
                      }
                      const token = localStorage.getItem("token");
                      try {
                        const res = await fetch("/api/actores/switch", {
                          method: "POST",
                          headers: { 
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}` 
                          },
                          body: JSON.stringify({ actorId: targetActorId }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          localStorage.setItem("token", data.token);
                          localStorage.setItem("actor", JSON.stringify(data.actor));
                          window.location.href = "/dashboard";
                        }
                      } catch (err) {
                        console.error("Error switching actor:", err);
                      }
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      borderRadius: "4px",
                      backgroundColor: "#334155",
                      color: "#fff",
                      border: "1px solid #475569",
                      cursor: "pointer",
                      outline: "none",
                      margin: "4px 8px"
                    }}
                  >
                    {availableActors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type === "warehouse" ? "Almacén" : a.type === "relief" ? "Ayuda" : "Transporte"})
                      </option>
                    ))}
                    <option value="create_new_profile">➕ Crear nuevo perfil...</option>
                  </select>
                )}
                <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/login" className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setHeaderMenuOpen(false)}>
                  Ingresar
                </Link>
                <Link href="/register" className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setHeaderMenuOpen(false)}>
                  Registrarse
                </Link>
              </div>
            )}
          </div>
        </nav>
        <div className="auth-section header-auth-desktop">
          {mounted && isAuthenticated ? (
            <>
              <span className="user-greeting">👋 Hola, <strong>{formName}</strong></span>
              {actor && availableActors.length > 0 && (
                <select 
                  value={actor.id} 
                  onChange={async (e) => {
                    const targetActorId = e.target.value;
                    if (targetActorId === "create_new_profile") {
                      window.location.href = "/dashboard?create_profile=true";
                      return;
                    }
                    const token = localStorage.getItem("token");
                    try {
                      const res = await fetch("/api/actores/switch", {
                        method: "POST",
                        headers: { 
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}` 
                        },
                        body: JSON.stringify({ actorId: targetActorId }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        localStorage.setItem("token", data.token);
                        localStorage.setItem("actor", JSON.stringify(data.actor));
                        window.location.href = "/dashboard";
                      }
                    } catch (err) {
                      console.error("Error switching actor:", err);
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    borderRadius: "4px",
                    backgroundColor: "#334155",
                    color: "#fff",
                    border: "1px solid #475569",
                    cursor: "pointer",
                    outline: "none",
                    margin: "0 8px"
                  }}
                >
                  {availableActors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type === "warehouse" ? "Almacén" : a.type === "relief" ? "Ayuda" : "Transporte"})
                    </option>
                  ))}
                  <option value="create_new_profile">➕ Crear nuevo perfil...</option>
                </select>
              )}
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
                Cerrar Sesión
              </button>
            </>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/login" className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 12 }}>
                Ingresar
              </Link>
              <Link href="/register" className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }}>
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Mobile sidebar toggle */}
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
          {sidebarOpen ? "✕" : "☰ Acciones"}
        </button>
        {/* Sidebar Section */}
        <aside 
          className={`homepage-sidebar ${sidebarOpen ? "open" : ""}`}
          style={sidebarStyle}
        >
          <div 
            className="sidebar-header" 
            style={{ padding: "12px 20px 20px 20px", cursor: "ns-resize" }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onClick={(e) => {
              // On mobile, clicking the header background toggles the expand/collapse of the sheet
              if ((e.target as HTMLElement).closest(".btn") || (e.target as HTMLElement).closest(".sidebar-expand-toggle")) return;
              setSidebarOpen(!sidebarOpen);
            }}
          >
            {/* Visual drag handle pill */}
            <div className="sidebar-drag-handle" style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
              <div style={{ width: "40px", height: "4px", backgroundColor: "rgba(255, 255, 255, 0.3)", borderRadius: "2px" }}></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#fff" }}>Acciones Rápidas</h3>
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{ 
                  background: "rgba(255, 255, 255, 0.15)", 
                  border: "none", 
                  color: "#fff", 
                  cursor: "pointer", 
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "background 0.2s"
                }}
                className="sidebar-expand-toggle"
              >
                {sidebarOpen ? "▼ Minimizar" : "▲ Ver Actividad"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openModal("request")} className="btn btn-danger" style={{ flex: 1, padding: "10px 6px", fontSize: 13, borderRadius: 8 }}>
                  🚨 Pedir Ayuda
                </button>
                <button onClick={() => openModal("supply")} className="btn btn-success" style={{ flex: 1, padding: "10px 6px", fontSize: 13, borderRadius: 8 }}>
                  📦 Ofrecer Ayuda
                </button>
              </div>
              <button onClick={() => openModal("driver")} className="btn btn-warning" style={{ width: "100%", padding: "10px", fontSize: 13, borderRadius: 8 }}>
                🚚 Quiero Transportar
              </button>
            </div>
          </div>

        {/* Navigation Tabs */}
        <div className="tab-nav">
          <button className={`tab-btn ${activeTab === "requests" ? "active" : ""}`} onClick={() => setActiveTab("requests")}>
            Solicitudes ({data.recentRequests.length})
          </button>
          <button className={`tab-btn ${activeTab === "shipments" ? "active" : ""}`} onClick={() => setActiveTab("shipments")}>
            Envíos ({data.recentShipments.length})
          </button>
        </div>

        {/* Content list */}
        <div className="activity-list">
          {loading ? (
            <p style={{ textAlign: "center", color: "#64748b", marginTop: 24, fontSize: 14 }}>Cargando datos recientes...</p>
          ) : activeTab === "requests" ? (
            data.recentRequests.length === 0 ? (
              <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 24, fontSize: 13 }}>No hay solicitudes recientes.</p>
            ) : (
              data.recentRequests.map((req) => (
                <div key={req.id} className="activity-card" onClick={() => handleCardClick(req.actor.id)}>
                  <div className="activity-card-header">
                    <span className="activity-card-title">{req.name}</span>
                    <span className="activity-card-time">{new Date(req.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="activity-card-body">
                    <p style={{ marginBottom: 4 }}>
                      Cant: <strong>{req.quantity} {req.unit}</strong>
                    </p>
                    <p style={{ fontSize: 12, color: "#64748b" }}>Solicita: {req.actor.name} ({req.actor.city || "Sin ciudad"})</p>
                  </div>
                  <div className="activity-card-footer" style={{ marginTop: 12 }}>
                    <span
                      className="badge"
                      style={{
                        background: getUrgencyBadgeColor(req.urgency),
                        color: getUrgencyTextColor(req.urgency),
                        padding: "2px 8px",
                      }}
                    >
                      Prioridad: {req.urgency}
                    </span>
                    {req.actor.whatsapp && (
                      <a
                        href={`https://wa.me/${req.actor.whatsapp.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(req.actor.name)},%20te%20contacto%20desde%20la%20plataforma%20de%20acopio.%20Vi%20tu%20solicitud%20de%20${encodeURIComponent(req.quantity)}%20${encodeURIComponent(req.unit)}%20de%20${encodeURIComponent(req.name)}%20y%20quiero%20coordinar%20ayuda.`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-success"
                        style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        💬 Enviar ayuda
                      </a>
                    )}
                  </div>
                </div>
              ))
            )
          ) : data.recentShipments.length === 0 ? (
            <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 24, fontSize: 13 }}>No hay envíos/viajes activos.</p>
          ) : (
            data.recentShipments.map((ship) => (
              <div key={ship.id} className="activity-card" onClick={() => handleCardClick(ship.centroAyuda.id)}>
                <div className="activity-card-header">
                  <span className="activity-card-title" style={{ color: "#2563eb" }}>Código: {ship.codigoViaje}</span>
                  <span className="activity-card-time">{new Date(ship.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="activity-card-body">
                  <p style={{ fontSize: 12, marginBottom: 4 }}>
                    <strong>Origen:</strong> {ship.almacen.name}
                  </p>
                  <p style={{ fontSize: 12, marginBottom: 4 }}>
                    <strong>Destino:</strong> {ship.centroAyuda.name}
                  </p>
                  <p style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                    Insumos: {ship.insumos.map((i) => `${i.quantity} ${i.unit} de ${i.name}`).join(", ")}
                  </p>
                </div>
                <div className="activity-card-footer" style={{ marginTop: 10 }}>
                  <span className="badge badge-proceso" style={{ padding: "2px 8px" }}>
                    {ship.estado === "proposed" ? "Por Transportar" : ship.estado === "assigned" ? "Conductor Asignado" : ship.estado === "in_transit" ? "En Tránsito" : "Entregado"}
                  </span>
                  {ship.estado === "proposed" ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openClaimModal(ship.id);
                      }}
                      className="btn btn-warning"
                      style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6 }}
                    >
                      🚚 Transportar
                    </button>
                  ) : (
                    ship.transportista?.whatsapp && (
                      <a
                        href={`https://wa.me/${ship.transportista.whatsapp.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(ship.transportista.name)},%20te%20contacto%20sobre%20el%20envío%20${encodeURIComponent(ship.codigoViaje)}.`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        💬 Contactar
                      </a>
                    )
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Map Section */}
      <main className="map-container-wrapper">
        <MapComponent 
          containerId="main-map" 
          actors={data.actors} 
          selectedActorId={selectedActorId} 
          sidebarOpen={sidebarOpen}
          onMapClick={() => {
            if (sidebarOpen) {
              setSidebarOpen(false);
            }
          }}
        />

        {/* Floating refresh button */}
        <button className="floating-refresh" onClick={fetchData} title="Actualizar datos">
          🔄
        </button>
      </main>

      {/* Action Modals */}
      {activeModal && activeModal !== "claim" && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px" }}>
            <h3>
              {activeModal === "request" && "🚨 Solicitar Insumos (Pedir Ayuda)"}
              {activeModal === "supply" && "📦 Ofrecer Insumos (Ofrecer Ayuda)"}
              {activeModal === "driver" && "🚚 Registrarse como Transportista"}
            </h3>

            {submitError && <div className="alert alert-error">{submitError}</div>}
            {submitSuccess && <div className="alert alert-success">{submitSuccess}</div>}

            <form onSubmit={handleSubmitAction}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label>Tu Nombre / Organización</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="Ej: Refugio Local" />
                </div>
                <div className="form-group">
                  <label>Tu WhatsApp</label>
                  <input value={formWhatsapp} onChange={(e) => setFormWhatsapp(e.target.value)} required placeholder="Ej: 573001234567" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label>Dirección</label>
                  <input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} required placeholder="Calle 123..." />
                </div>
                <div className="form-group">
                  <label>Ciudad</label>
                  <input value={formCity} onChange={(e) => setFormCity(e.target.value)} required placeholder="Bogotá" />
                </div>
              </div>

              {/* Map Coordinates Picker */}
              <div className="form-group">
                <span className="map-instructions">📍 Ubicación (haz clic en el mapa para marcar):</span>
                <div className="register-map-wrapper" style={{ height: "180px", marginBottom: "16px" }}>
                  <MapComponent
                    containerId="modal-map"
                    actors={[]}
                    interactive={true}
                    onLocationSelected={(lat, lng) => {
                      setFormLat(lat);
                      setFormLng(lng);
                    }}
                    onAddressFound={(address, city) => {
                      setFormAddress(address);
                      setFormCity(city);
                    }}
                  />
                </div>
              </div>

              {/* Specific fields */}
              {activeModal === "driver" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label>Tipo de Vehículo</label>
                    <input value={formVehicleType} onChange={(e) => setFormVehicleType(e.target.value)} required placeholder="Camioneta, Camión, etc." />
                  </div>
                  <div className="form-group">
                    <label>Capacidad Máxima (kg)</label>
                    <input type="number" value={formCapacityKg} onChange={(e) => setFormCapacityKg(e.target.value)} required placeholder="500" />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label>Categoría</label>
                      <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                        <option value="general">General</option>
                        <option value="agua">Agua</option>
                        <option value="alimentos">Alimentos</option>
                        <option value="medicinas">Medicinas</option>
                        <option value="ropa">Ropa</option>
                        <option value="herramientas">Herramientas</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Insumo / Item</label>
                      <input value={formItemName} onChange={(e) => setFormItemName(e.target.value)} required placeholder="Ej: Agua en botellas" />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label>Cantidad</label>
                      <input type="number" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} required min="1" placeholder="10" />
                    </div>
                    <div className="form-group">
                      <label>Unidad</label>
                      <select value={formUnit} onChange={(e) => setFormUnit(e.target.value)}>
                        <option value="unidades">Unidades</option>
                        <option value="kg">Kilogramos</option>
                        <option value="litros">Litros</option>
                        <option value="cajas">Cajas</option>
                        <option value="palets">Palets</option>
                      </select>
                    </div>
                  </div>

                  {activeModal === "request" && (
                    <div className="form-group">
                      <label>Urgencia</label>
                      <select value={formUrgency} onChange={(e) => setFormUrgency(e.target.value)}>
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                        <option value="critica">Crítica</option>
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Notas Adicionales</label>
                    <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Detalles de la entrega..." rows={2} />
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitLoading}>
                  {submitLoading ? "Publicando..." : "Publicar Ahora"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Claim Trip Modal */}
      {activeModal === "claim" && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>🚚 Transportar este envío</h3>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Ingresa tus datos para aceptar el envío. Te enviaremos los detalles del remitente y destinatario para coordinar por WhatsApp.
            </p>

            {submitError && <div className="alert alert-error">{submitError}</div>}
            {submitSuccess && <div className="alert alert-success">{submitSuccess}</div>}

            <form onSubmit={handleClaimTrip}>
              <div className="form-group">
                <label>Tu Nombre Completo</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="Ej: Carlos Gomez" />
              </div>
              <div className="form-group">
                <label>Tu WhatsApp</label>
                <input value={formWhatsapp} onChange={(e) => setFormWhatsapp(e.target.value)} required placeholder="Ej: 573001234567" />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitLoading}>
                  {submitLoading ? "Asignando..." : "Aceptar y Coordinar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
