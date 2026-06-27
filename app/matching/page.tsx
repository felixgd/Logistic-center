"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import TableSearch from "@/components/TableSearch";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";

export default function MatchingPage() {
  const router = useRouter();
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [selectedSolicitud, setSelectedSolicitud] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchMatches, setSearchMatches] = useState("");
  const [searchPendientes, setSearchPendientes] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    fetch("/api/solicitudes/pendientes").then((r) => r.json()).then(setPendientes).catch(() => {});
  }, [token, router]);

  const buscarMatches = async (solicitudId: string) => {
    setError(""); setSuccess("");
    const res = await fetch(`/api/matching/solicitud/${solicitudId}`, { headers });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    const sol = pendientes.find((p) => p.id === solicitudId);
    setSelectedSolicitud(sol);
    setMatches(data.matches || []);
  };

  const crearViaje = async () => {
    if (!selectedSolicitud || matches.length === 0) return;
    setError("");
    const porAlmacen = new Map<string, { items: any[]; requestId: string; reliefActorId: string }>();
    for (const m of matches) {
      const id = m.almacenId;
      const requestId = m.requestId || selectedSolicitud.id;
      const reliefActorId = m.reliefActorId || selectedSolicitud.actorId;
      if (!requestId || requestId === "auto" || !reliefActorId) {
        setError("No se puede crear el viaje: falta información de la solicitud o centro de ayuda.");
        return;
      }
      if (!porAlmacen.has(id)) porAlmacen.set(id, { items: [], requestId, reliefActorId });
      porAlmacen.get(id)!.items.push(m);
    }
    try {
      for (const [almacenId, grupo] of porAlmacen) {
        const res = await fetch("/api/viajes", {
          method: "POST", headers,
          body: JSON.stringify({
            warehouseActorId: almacenId,
            reliefActorId: grupo.reliefActorId,
            requestId: grupo.requestId,
            items: grupo.items.map((m: any) => ({ name: m.insumo, quantity: Math.min(m.cantidadDisponible, m.cantidadRequerida), unit: m.unidad, supplyId: m.supplyId })),
          }),
        });
        if (!res.ok) { setError((await res.json()).error); return; }
      }
      setSuccess("Viaje(s) creado(s) exitosamente!");
      setSelectedSolicitud(null); setMatches([]);
      const r = await fetch("/api/solicitudes/pendientes"); setPendientes(await r.json());
    } catch { setError("Error al crear viaje"); }
  };

  const matchesWithCenter = matches.map((m: any) => ({
    ...m,
    _centro: m.centroAyuda || "",
  }));
  const filteredMatches = useSearch(matchesWithCenter, searchMatches, [
    "centroAyuda", "almacenNombre", "insumo", "cantidadDisponible",
    "cantidadRequerida", "distancia", "unidad",
  ]);
  const { sortedData: sortedMatches, SortHeader: SortHeaderM } = useSort(filteredMatches, "insumo");

  const pendientesMapped = pendientes.map((p: any) => ({ ...p, _centro: p.actor?.name || "" }));
  const filteredPendientes = useSearch(pendientesMapped, searchPendientes, [
    "_centro", "name", "quantity", "urgency",
  ]);
  const { sortedData: sortedPendientes, SortHeader: SortHeaderP } = useSort(
    filteredPendientes,
    "_centro"
  );

  const crearViajeAutomatico = async () => {
    setError(""); setSuccess("");
    const res = await fetch("/api/matching/automatico", { method: "POST", headers });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    if (data.totalMatches === 0) {
      setSuccess(data.mensaje || "No se encontraron matches automáticos.");
      setMatches([]);
      setSelectedSolicitud(null);
      return;
    }
    setSuccess(`Matching automático completado. ${data.totalMatches} solicitudes con match.`);
    const flat = data.matches.flatMap((m: any) =>
      (m.almacenes || []).map((a: any) => ({
        almacenId: a.almacenId,
        almacenNombre: a.nombre,
        supplyId: a.supplyId,
        insumo: m.insumo,
        cantidadDisponible: a.cantidadDisponible,
        cantidadRequerida: m.cantidad,
        unidad: a.unidad || "unidad",
        distancia: a.distancia || 0,
        requestId: m.requestId,
        reliefActorId: m.reliefActorId,
        centroAyuda: m.centroAyuda,
      }))
    );
    setMatches(flat);
    setSelectedSolicitud({ id: "auto", actor: { name: "Múltiples centros" } });
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
        {matches.length > 0 && (
          <div className="card">
            <h3>Matches Encontrados</h3>
            <p style={{ color: "#6b7280", marginBottom: 12, fontSize: 14 }}>Para: {selectedSolicitud?.actor?.name}</p>
            <TableSearch value={searchMatches} onChange={setSearchMatches} placeholder="Buscar match..." />
            {sortedMatches.length === 0 ? (
              <p style={{ color: "#9ca3af", padding: "12px 0" }}>No se encontraron matches con "{searchMatches}".</p>
            ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr>{matches[0]?.centroAyuda && <SortHeaderM label="Centro" sortKey="centroAyuda" />}<SortHeaderM label="Almacén" sortKey="almacenNombre" /><SortHeaderM label="Insumo" sortKey="insumo" /><SortHeaderM label="Disponible" sortKey="cantidadDisponible" /><SortHeaderM label="Requerido" sortKey="cantidadRequerida" /><SortHeaderM label="Distancia" sortKey="distancia" /></tr></thead>
                <tbody>
                  {sortedMatches.map((m: any, i: number) => (
                    <tr key={i}>
                      {m.centroAyuda && <td>{m.centroAyuda}</td>}
                      <td>{m.almacenNombre}</td><td>{m.insumo}</td><td>{m.cantidadDisponible} {m.unidad}</td><td>{m.cantidadRequerida} {m.unidad}</td>
                      <td>{m.distancia > 0 ? `${m.distancia} km` : "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            <button className="btn btn-success" style={{ marginTop: 16 }} onClick={crearViaje}>Crear Viaje(s)</button>
          </div>
        )}
        <div className="card">
          <h3>Solicitudes Pendientes ({pendientes.length})</h3>
          {pendientes.length === 0 ? (
            <p style={{ color: "#9ca3af", marginTop: 12 }}>No hay solicitudes pendientes.</p>
          ) : (
            <>
            <TableSearch value={searchPendientes} onChange={setSearchPendientes} placeholder="Buscar solicitud..." />
            {sortedPendientes.length === 0 ? (
              <p style={{ color: "#9ca3af", padding: "12px 0" }}>No se encontraron solicitudes con "{searchPendientes}".</p>
            ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><SortHeaderP label="Centro" sortKey="_centro" /><SortHeaderP label="Insumo" sortKey="name" /><SortHeaderP label="Cantidad" sortKey="quantity" /><SortHeaderP label="Urgencia" sortKey="urgency" /><th>Acción</th></tr></thead>
                <tbody>
                  {sortedPendientes.map((p: any) => (
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
            </div>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
