"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function MatchingPage() {
  const router = useRouter();
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [selectedSolicitud, setSelectedSolicitud] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    fetch("/api/solicitudes/pendientes").then((r) => r.json()).then(setPendientes).catch(() => {});
  }, [token, router]);

  const buscarMatches = async (solicitudId: string) => {
    setError(""); setSuccess("");
    const res = await fetch(`/api/matching/solicitud/${solicitudId}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    const sol = pendientes.find((p) => p.id === solicitudId);
    setSelectedSolicitud(sol);
    setMatches(data.matches || []);
  };

  const crearViaje = async () => {
    if (!selectedSolicitud || matches.length === 0) return;
    setError("");
    const map = new Map<string, any[]>();
    for (const m of matches) {
      const id = m.almacenId;
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(m);
    }
    try {
      for (const [almacenId, items] of map) {
        const res = await fetch("/api/viajes", {
          method: "POST", headers,
          body: JSON.stringify({
            warehouseActorId: almacenId,
            reliefActorId: selectedSolicitud.actorId,
            requestId: selectedSolicitud.id,
            items: items.map((m: any) => ({ name: m.insumo, quantity: m.cantidadRequerida, unit: m.unidad, supplyId: m.supplyId })),
          }),
        });
        if (!res.ok) { setError((await res.json()).error); return; }
      }
      setSuccess("Viaje(s) creado(s) exitosamente!");
      setSelectedSolicitud(null); setMatches([]);
      const r = await fetch("/api/solicitudes/pendientes"); setPendientes(await r.json());
    } catch { setError("Error al crear viaje"); }
  };

  const crearViajeAutomatico = async () => {
    setError(""); setSuccess("");
    const res = await fetch("/api/matching/automatico", { method: "POST", headers });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setSuccess(`Matching automático completado. ${data.totalMatches} solicitudes con match.`);
    const r = await fetch("/api/solicitudes/pendientes"); setPendientes(await r.json());
  };

  return (
    <div>
      <Navbar />
      <div className="container">
        <div className="page-header">
          <h2>Matching Oferta - Demanda</h2>
          <button className="btn btn-warning" onClick={crearViajeAutomatico}>Matching Automático</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <div className="card">
          <h3>Solicitudes Pendientes ({pendientes.length})</h3>
          {pendientes.length === 0 ? (
            <p style={{ color: "#9ca3af", marginTop: 12 }}>No hay solicitudes pendientes.</p>
          ) : (
            <table>
              <thead><tr><th>Centro</th><th>Insumo</th><th>Cantidad</th><th>Urgencia</th><th>Acción</th></tr></thead>
              <tbody>
                {pendientes.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.actor?.name || "N/A"}</td>
                    <td>{p.name}</td>
                    <td>{p.quantity} {p.unit}</td>
                    <td><span className={`badge ${p.urgency === "critica" ? "badge-critica" : p.urgency === "alta" ? "badge-pendiente" : ""}`}>{p.urgency}</span></td>
                    <td><button className="btn btn-primary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => buscarMatches(p.id)}>Buscar Match</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {matches.length > 0 && (
          <div className="card">
            <h3>Matches Encontrados</h3>
            <p style={{ color: "#6b7280", marginBottom: 12, fontSize: 14 }}>Para: {selectedSolicitud?.actor?.name}</p>
            <table>
              <thead><tr><th>Almacén</th><th>Insumo</th><th>Disponible</th><th>Requerido</th><th>Distancia</th></tr></thead>
              <tbody>
                {matches.map((m: any, i: number) => (
                  <tr key={i}>
                    <td>{m.almacenNombre}</td><td>{m.insumo}</td><td>{m.cantidadDisponible} {m.unidad}</td><td>{m.cantidadRequerida} {m.unidad}</td>
                    <td>{m.distancia > 0 ? `${m.distancia} km` : "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-success" style={{ marginTop: 16 }} onClick={crearViaje}>Crear Viaje(s)</button>
          </div>
        )}
      </div>
    </div>
  );
}
