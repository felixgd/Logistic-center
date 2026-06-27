"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import NavegacionViaje from "@/components/NavegacionViaje";

export default function TripsPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [trips, setTrips] = useState<any[]>([]);
  const [disponibles, setDisponibles] = useState<any[]>([]);
  const [tab, setTab] = useState("mis-viajes");
  const [error, setError] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    const [r1, r2] = await Promise.all([
      fetch("/api/viajes", { headers }).then((r) => r.json()),
      fetch("/api/viajes/disponibles").then((r) => r.json()),
    ]);
    setTrips(Array.isArray(r1) ? r1 : []);
    setDisponibles(Array.isArray(r2) ? r2 : []);
  };

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    setActor(JSON.parse(localStorage.getItem("actor") || "{}"));
    load();
  }, [token, router]);

  const assignTrip = async (id: string) => {
    setError("");
    const res = await fetch(`/api/viajes/${id}/asignar`, { method: "POST", headers, body: JSON.stringify({}) });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    alert("Viaje asignado exitosamente!"); load();
  };

  const updateStatus = async (id: string, estado: string) => {
    await fetch(`/api/viajes/${id}/estado`, { method: "PATCH", headers, body: JSON.stringify({ status: estado }) });
    load();
  };

  const statusBadge = (s: string) => `badge ${({ proposed: "badge-pendiente", assigned: "badge-proceso", in_transit: "badge-proceso", delivered: "badge-completado", cancelled: "badge-cancelado" } as any)[s] || ""}`;

  return (
    <div>
      <Navbar />
      <div className="container">
        <div className="page-header">
          <h2>Viajes</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className={`btn ${tab === "mis-viajes" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("mis-viajes")}>Mis Viajes</button>
            {actor.type === "transporter" && <button className={`btn ${tab === "disponibles" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("disponibles")}>Disponibles ({disponibles.length})</button>}
          </div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        {tab === "mis-viajes" && (trips.length === 0 ? (
          <div className="card empty-state"><h3>No hay viajes</h3><p>Aparecerán cuando se coordinen envíos.</p></div>
        ) : (
          <div className="card">
            <table>
              <thead><tr><th>Código</th><th>Almacén</th><th>Centro</th><th>Insumos</th><th>Transportista</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {trips.map((t: any) => (
                  <tr key={t.id}>
                    <td><strong>{t.codigoViaje}</strong></td>
                    <td>{t.almacen?.name || "N/A"}</td>
                    <td>{t.centroAyuda?.name || "N/A"}</td>
                    <td style={{ fontSize: 13 }}>{(t.insumos || []).map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(", ")}</td>
                    <td>{t.transportista?.name || "—"}</td>
                    <td><span className={statusBadge(t.estado)}>{t.estado}</span></td>
                    <td style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => router.push(`/viajes/${t.id}/manifiesto`)}>Manifiesto</button>
                      {(t.estado === "assigned" || t.estado === "in_transit") && t.transportista?.id === actor.id && (
                        <NavegacionViaje origen={t.almacen} destino={t.centroAyuda} />
                      )}
                      {t.estado === "assigned" && t.transportista?.id === actor.id && (
                        <button className="btn btn-success" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => updateStatus(t.id, "in_transit")}>Iniciar</button>
                      )}
                      {t.estado === "in_transit" && (
                        <button className="btn btn-success" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => updateStatus(t.id, "delivered")}>Completar</button>
                      )}
                      {t.estado === "proposed" && (actor.id === t.almacen?.id || actor.id === t.centroAyuda?.id) && (
                        <button className="btn btn-danger" style={{ padding: "4px 12px", fontSize: 12 }} onClick={async () => { if (confirm("¿Cancelar este viaje?")) { await updateStatus(t.id, "cancelled"); } }}>Cancelar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {tab === "disponibles" && (disponibles.length === 0 ? (
          <div className="card empty-state"><h3>No hay viajes disponibles</h3><p>Revisa más tarde.</p></div>
        ) : (
          <div className="card">
            <table>
              <thead><tr><th>Código</th><th>Origen</th><th>Destino</th><th>Insumos</th><th>Acción</th></tr></thead>
              <tbody>
                {disponibles.map((t: any) => (
                  <tr key={t.id}>
                    <td><strong>{t.codigoViaje}</strong></td>
                    <td>{t.almacen?.name}</td>
                    <td>{t.centroAyuda?.name}</td>
                    <td>{t.insumos?.map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(", ")}</td>
                    <td><button className="btn btn-success" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => assignTrip(t.id)}>Tomar Viaje</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
