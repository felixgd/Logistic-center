"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import NavegacionViaje from "@/components/NavegacionViaje";
import TableSearch from "@/components/TableSearch";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";

export default function TripsPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [trips, setTrips] = useState<any[]>([]);
  const [disponibles, setDisponibles] = useState<any[]>([]);
  const [tab, setTab] = useState("mis-viajes");
  const [error, setError] = useState("");
  const [searchTrips, setSearchTrips] = useState("");
  const [searchDisponibles, setSearchDisponibles] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const statusOptions = [
    { key: "todos", label: "Todos" },
    { key: "proposed", label: "Propuestos" },
    { key: "approved", label: "Aprobados" },
    { key: "assigned", label: "Asignados" },
    { key: "in_transit", label: "En tránsito" },
    { key: "delivered", label: "Completados" },
    { key: "cancelled", label: "Cancelados" },
  ];

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

  const statusBadge = (s: string) => `badge ${({ proposed: "badge-pendiente", approved: "badge-pendiente", assigned: "badge-proceso", in_transit: "badge-proceso", delivered: "badge-completado", cancelled: "badge-cancelado" } as any)[s] || ""}`;

  const formatDate = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—";

  const insumosText = (t: any) =>
    (t.insumos || []).map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(", ");

  const tripsMapped = trips.map((t: any) => ({
    ...t,
    _almacen: t.almacen?.name || "",
    _centro: t.centroAyuda?.name || "",
    _transportista: t.transportista?.name || "",
    _insumosText: insumosText(t),
  }));
  const filteredTrips = useSearch(tripsMapped, searchTrips, [
    "codigoViaje", "_almacen", "_centro", "_insumosText", "_transportista", "estado",
  ]);
  const { sortedData: sortedTrips, SortHeader: SortHeader1 } = useSort(filteredTrips, "codigoViaje");

  const displayedTrips = statusFilter === "todos" ? sortedTrips : sortedTrips.filter((t: any) => t.estado === statusFilter);

  const disponiblesMapped = disponibles.map((t: any) => ({
    ...t,
    _origen: t.almacen?.name || "",
    _destino: t.centroAyuda?.name || "",
    _insumosText: insumosText(t),
  }));
  const filteredDisponibles = useSearch(disponiblesMapped, searchDisponibles, [
    "codigoViaje", "_origen", "_destino", "_insumosText",
  ]);
  const { sortedData: sortedDisponibles, SortHeader: SortHeader2 } = useSort(filteredDisponibles, "codigoViaje");

  const formatDate = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—";

  const insumosText = (t: any) =>
    (t.insumos || []).map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(", ");

  const tripsMapped = trips.map((t: any) => ({
    ...t,
    _almacen: t.almacen?.name || "",
    _centro: t.centroAyuda?.name || "",
    _transportista: t.transportista?.name || "",
    _insumosText: insumosText(t),
  }));
  const filteredTrips = useSearch(tripsMapped, searchTrips, [
    "codigoViaje", "_almacen", "_centro", "_insumosText", "_transportista", "estado",
  ]);
  const { sortedData: sortedTrips, SortHeader: SortHeader1 } = useSort(filteredTrips, "codigoViaje");

  const disponiblesMapped = disponibles.map((t: any) => ({
    ...t,
    _origen: t.almacen?.name || "",
    _destino: t.centroAyuda?.name || "",
    _insumosText: insumosText(t),
  }));
  const filteredDisponibles = useSearch(disponiblesMapped, searchDisponibles, [
    "codigoViaje", "_origen", "_destino", "_insumosText",
  ]);
  const { sortedData: sortedDisponibles, SortHeader: SortHeader2 } = useSort(filteredDisponibles, "codigoViaje");

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

        {tab === "mis-viajes" && trips.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {statusOptions.map((opt) => {
              const count = opt.key === "todos" ? trips.length : trips.filter((t: any) => t.estado === opt.key).length;
              return (
                <button
                  key={opt.key}
                  className={`btn ${statusFilter === opt.key ? "btn-primary" : "btn-secondary"}`}
                  style={{ padding: "6px 12px", fontSize: 13 }}
                  onClick={() => setStatusFilter(opt.key)}
                >
                  {opt.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {tab === "mis-viajes" && (trips.length === 0 ? (
          <div className="card empty-state"><h3>No hay viajes</h3><p>Aparecerán cuando se coordinen envíos.</p></div>
        ) : (
          <div className="card">
            <TableSearch value={searchTrips} onChange={setSearchTrips} placeholder="Buscar viaje..." />
            {displayedTrips.length === 0 ? (
              <p style={{ color: "#9ca3af", padding: "12px 0" }}>No se encontraron viajes{statusFilter !== "todos" ? ` en estado "${statusOptions.find(o => o.key === statusFilter)?.label}"` : searchTrips ? ` con "${searchTrips}"` : ""}.</p>
            ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><SortHeader1 label="Código" sortKey="codigoViaje" /><SortHeader1 label="Almacén" sortKey="_almacen" /><SortHeader1 label="Centro" sortKey="_centro" /><SortHeader1 label="Insumos" sortKey="_insumosText" /><SortHeader1 label="Transportista" sortKey="_transportista" /><SortHeader1 label="Estado" sortKey="estado" /><SortHeader1 label="Creado" sortKey="createdAt" /><SortHeader1 label="Actualizado" sortKey="updatedAt" /><th>Acciones</th></tr></thead>
                <tbody>
                  {sortedTrips.map((t: any) => (
                    <tr key={t.id}>
                      <td><strong>{t.codigoViaje}</strong></td>
                      <td>{t.almacen?.name || "N/A"}</td>
                      <td>{t.centroAyuda?.name || "N/A"}</td>
                      <td style={{ fontSize: 13 }}>{(t.insumos || []).map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(", ")}</td>
                      <td>{t.transportista?.name || "—"}</td>
                      <td><span className={statusBadge(t.estado)}>{t.estado}</span></td>
                      <td style={{ fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" }}>{formatDate(t.createdAt)}</td>
                      <td style={{ fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" }}>{formatDate(t.updatedAt)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                          <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => router.push(`/viajes/${t.id}/manifiesto`)}>Manifiesto</button>
                          {t.estado === "proposed" && actor.id === t.almacen?.id && (
                            <button className="btn btn-success" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => updateStatus(t.id, "approved")}>Aprobar</button>
                          )}
                          {(t.estado === "assigned" || t.estado === "in_transit") && t.transportista?.id === actor.id && (
                            <NavegacionViaje origen={t.almacen} destino={t.centroAyuda} />
                          )}
                          {t.estado === "assigned" && t.transportista?.id === actor.id && (
                            <button className="btn btn-success" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => updateStatus(t.id, "in_transit")}>Iniciar</button>
                          )}
                          {t.estado === "in_transit" && t.transportista?.id === actor.id && (
                            <button className="btn btn-success" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => updateStatus(t.id, "delivered")}>Completar</button>
                          )}
                          {(t.estado === "proposed" || t.estado === "approved") && (actor.id === t.almacen?.id || actor.id === t.centroAyuda?.id) && (
                            <button className="btn btn-danger" style={{ padding: "4px 12px", fontSize: 12 }} onClick={async () => { if (confirm("¿Cancelar este viaje?")) { await updateStatus(t.id, "cancelled"); } }}>Cancelar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        ))}

        {tab === "disponibles" && (disponibles.length === 0 ? (
          <div className="card empty-state"><h3>No hay viajes disponibles</h3><p>Revisa más tarde.</p></div>
        ) : (
          <div className="card">
            <TableSearch value={searchDisponibles} onChange={setSearchDisponibles} placeholder="Buscar viaje disponible..." />
            {sortedDisponibles.length === 0 ? (
              <p style={{ color: "#9ca3af", padding: "12px 0" }}>No se encontraron viajes con "{searchDisponibles}".</p>
            ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><SortHeader2 label="Código" sortKey="codigoViaje" /><SortHeader2 label="Origen" sortKey="_origen" /><SortHeader2 label="Destino" sortKey="_destino" /><SortHeader2 label="Insumos" sortKey="_insumosText" /><SortHeader2 label="Creado" sortKey="createdAt" /><SortHeader2 label="Actualizado" sortKey="updatedAt" /><th>Acción</th></tr></thead>
                <tbody>
                  {sortedDisponibles.map((t: any) => (
                    <tr key={t.id}>
                      <td><strong>{t.codigoViaje}</strong></td>
                      <td>{t.almacen?.name}</td>
                      <td>{t.centroAyuda?.name}</td>
                      <td>{t.insumos?.map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(", ")}</td>
                      <td style={{ fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" }}>{formatDate(t.createdAt)}</td>
                      <td style={{ fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" }}>{formatDate(t.updatedAt)}</td>
                    <td><button className="btn btn-success" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => assignTrip(t.id)}>Tomar Viaje</button></td>
                  </tr>
                  ))}
              </tbody>
            </table>
            </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
