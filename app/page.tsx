"use client";
import { useState, useEffect } from "react";
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
  };
  centroAyuda: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
  };
  transportista: {
    id: string;
    name: string;
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

  useEffect(() => {
    fetchData();
    // Check authentication
    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleCardClick = (actorId: string) => {
    setSelectedActorId(null);
    // Tiny timeout to trigger the change and center Leaflet
    setTimeout(() => {
      setSelectedActorId(actorId);
    }, 50);
  };

  const getUrgencyBadgeColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case "alta":
      case "urgente":
      case "crítica":
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

  return (
    <div className="homepage-container">
      {/* Sidebar Section */}
      <aside className="homepage-sidebar">
        <div className="sidebar-header">
          <h1>📦 Logística Acopio</h1>
          <p className="subtitle">Monitoreo humanitario en tiempo real</p>

          <div className="sidebar-actions">
            {isAuthenticated ? (
              <Link href="/dashboard" className="btn btn-primary" style={{ flex: 1, textAlign: "center", fontSize: 13, padding: "8px 12px" }}>
                Ir al Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-primary" style={{ flex: 1, textAlign: "center", fontSize: 13, padding: "8px 12px" }}>
                  Ingresar
                </Link>
                <Link href="/register" className="btn btn-secondary" style={{ flex: 1, textAlign: "center", fontSize: 13, padding: "8px 12px" }}>
                  Registrarse
                </Link>
              </>
            )}
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
                  <div className="activity-card-footer">
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
                    <span className="badge" style={{ background: "#eff6ff", color: "#2563eb", padding: "2px 8px" }}>
                      {getStatusLabel(req.status)}
                    </span>
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
                  <p style={{ fontSize: 11, color: "#64748b" }}>
                    Insumos: {ship.insumos.map((i) => `${i.quantity} ${i.unit} de ${i.name}`).join(", ")}
                  </p>
                </div>
                <div className="activity-card-footer">
                  <span className="badge badge-proceso" style={{ padding: "2px 8px" }}>
                    {ship.estado === "proposed" ? "Propuesto" : ship.estado === "assigned" ? "Asignado" : ship.estado === "in_transit" ? "En Tránsito" : "Entregado"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Map Section */}
      <main className="map-container-wrapper">
        <MapComponent actors={data.actors} selectedActorId={selectedActorId} />

        {/* Floating refresh button */}
        <button className="floating-refresh" onClick={fetchData} title="Actualizar datos">
          🔄
        </button>
      </main>
    </div>
  );
}
