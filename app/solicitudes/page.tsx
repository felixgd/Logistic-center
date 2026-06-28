"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import TableSearch from "@/components/TableSearch";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { useApi, invalidateCache } from "@/lib/swr";
import { getAuthHeaders } from "@/lib/api-client";

export default function RequestsPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [requests, setRequests] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "general", name: "", unit: "unidades", quantity: "", urgency: "media", notes: "" });
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [envioForm, setEnvioForm] = useState<{ requestId: string; quantity: string } | null>(null);
  const [envioLoading, setEnvioLoading] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = getAuthHeaders();

  const { data: requestsData } = useApi<any[]>(token ? "/api/solicitudes" : null);

  useEffect(() => {
    if (requestsData) setRequests(requestsData);
  }, [requestsData]);

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    const a = JSON.parse(localStorage.getItem("actor") || "{}");
    setActor(a);
    if (a.type === "transporter") { router.push("/dashboard"); return; }
  }, [token, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    const res = await fetch("/api/solicitudes", { method: "POST", headers, body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setForm({ category: "general", name: "", unit: "unidades", quantity: "", urgency: "media", notes: "" });
    setShowForm(false);
    invalidateCache("/api/solicitudes");
  };

  const STATUS_LABELS: Record<string, string> = {
    open: "Abierta",
    in_progress: "En progreso",
    fulfilled: "Completada",
    cancelled: "Cancelada",
  };

  const statusBadge = (status: string) => `badge ${({ open: "badge-pendiente", in_progress: "badge-proceso", fulfilled: "badge-completado", cancelled: "badge-cancelado" } as any)[status] || ""}`;

  const urgencyOrder: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
  const statusOrder: Record<string, number> = { open: 0, in_progress: 1, fulfilled: 2, cancelled: 3 };

  const requestsMapped = requests.map((r: any) => {
    const uo = String(urgencyOrder[r.urgency] ?? 4).padStart(2, "0");
    const so = String(statusOrder[r.status] ?? 4).padStart(2, "0");
    return {
      ...r,
      _centro: r.actor?.name || "",
      _urgenciaOrden: uo,
      _estadoOrden: so,
      _sortKey: `${uo}_${so}_${r.createdAt}`,
    };
  });
  const filteredRequests = useSearch(requestsMapped, searchTerm, [
    "_centro", "name", "quantity", "urgency", "status", "createdAt",
  ]);
  const { sortedData: sortedRequests, SortHeader } = useSort(filteredRequests, "_sortKey");

  const handleCancel = async (id: string) => {
    if (!confirm("¿Cancelar esta solicitud?")) return;
    const res = await fetch(`/api/solicitudes/${id}/estado`, { method: "PATCH", headers, body: JSON.stringify({ status: "cancelled" }) });
    if (!res.ok) { setError((await res.json()).error); return; }
    invalidateCache("/api/solicitudes");
  };

  const handleCrearEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!envioForm) return;

    const request = requests.find((r: any) => r.id === envioForm.requestId);
    if (!request) return;

    setEnvioLoading(true);
    try {
      const actorData = JSON.parse(localStorage.getItem("actor") || "{}");

      // 1. Buscar si ya existe un insumo con el mismo nombre
      const suppliesRes = await fetch("/api/insumos", { headers });
      const supplies = await suppliesRes.json();
      let supply = supplies.find((s: any) => s.name.toLowerCase() === request.name.toLowerCase());

      // 2. Si no existe, crearlo
      if (!supply) {
        const createRes = await fetch("/api/insumos", {
          method: "POST",
          headers,
          body: JSON.stringify({
            category: request.category || "general",
            name: request.name,
            unit: request.unit,
            quantity: Number(envioForm.quantity),
          }),
        });
        if (!createRes.ok) {
          const data = await createRes.json();
          setError(data.error || "Error al crear el insumo");
          setEnvioLoading(false);
          return;
        }
        supply = await createRes.json();
      }

      // 3. Crear el viaje
      const tripRes = await fetch("/api/viajes", {
        method: "POST",
        headers,
        body: JSON.stringify({
          warehouseActorId: actorData.id,
          reliefActorId: request.actorId,
          requestId: request.id,
          items: [{
            supplyId: supply.id,
            name: request.name,
            quantity: Number(envioForm.quantity),
            unit: request.unit,
          }],
        }),
      });
      if (!tripRes.ok) {
        const data = await tripRes.json();
        setError(data.error || "Error al crear el envío");
        setEnvioLoading(false);
        return;
      }

      setEnvioForm(null);
      invalidateCache("/api/solicitudes");
    } catch {
      setError("Error al procesar la solicitud");
    } finally {
      setEnvioLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="container">
        <div className="page-header">
          <h2>Solicitudes de Insumos</h2>
          {actor.type === "relief" && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nueva Solicitud</button>}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Nueva Solicitud</h3>
              <form onSubmit={handleCreate}>
                <div className="form-group"><label>Categoría</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    <option value="general">General</option><option value="agua">Agua</option><option value="alimentos">Alimentos</option>
                    <option value="medicinas">Medicinas</option><option value="ropa">Ropa</option><option value="herramientas">Herramientas</option>
                  </select>
                </div>
                <div className="form-group"><label>Insumo</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}><label>Cantidad</label><input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} required min="1" /></div>
                  <div className="form-group" style={{ flex: 1 }}><label>Unidad</label>
                    <select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                      <option value="unidades">Unidades</option><option value="kg">Kilogramos</option><option value="litros">Litros</option><option value="cajas">Cajas</option><option value="palets">Palets</option>
                    </select>
                  </div>
                </div>
                <div className="form-group"><label>Urgencia</label>
                  <select value={form.urgency} onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}>
                    <option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Crítica</option>
                  </select>
                </div>
                <div className="form-group"><label>Notas</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Crear Solicitud</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {envioForm && (() => {
          const req = requests.find((r: any) => r.id === envioForm.requestId);
          if (!req) return null;
          return (
            <div className="modal-overlay" onClick={() => !envioLoading && setEnvioForm(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>Crear envío</h3>
                <form onSubmit={handleCrearEnvio}>
                  <div className="card" style={{ marginBottom: 12, padding: 12, background: "var(--bg-main)" }}>
                    <p><strong>Solicitud:</strong> {req.name}</p>
                    <p><strong>Centro:</strong> {req.actor?.name || "N/A"}</p>
                    <p><strong>Cantidad solicitada:</strong> {req.quantityOriginal || req.quantity} {req.unit}</p>
                    {req.quantityFulfilled > 0 && <p><strong>Entregados:</strong> {req.quantityFulfilled} {req.unit}</p>}
                    <p><strong>Urgencia:</strong> {req.urgency}</p>
                  </div>
                  <div className="form-group">
                    <label>Cantidad a enviar</label>
                    <input type="number" value={envioForm.quantity} onChange={(e) => setEnvioForm({ ...envioForm, quantity: e.target.value })} required min="1" max={req.quantity} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEnvioForm(null)} disabled={envioLoading}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={envioLoading}>{envioLoading ? "Creando..." : "Confirmar envío"}</button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}
        {requests.length === 0 ? (
          <div className="card empty-state"><h3>No hay solicitudes</h3><p>Los centros de ayuda pueden crear solicitudes.</p></div>
        ) : (
          <div className="card">
            <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar solicitud..." />
            {sortedRequests.length === 0 ? (
              <p style={{ color: "#9ca3af", padding: "12px 0" }}>No se encontraron solicitudes con "{searchTerm}".</p>
            ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><SortHeader label="Centro" sortKey="_centro" /><SortHeader label="Insumo" sortKey="name" /><SortHeader label="Cantidad" sortKey="quantity" /><SortHeader label="Urgencia" sortKey="urgency" /><SortHeader label="Estado" sortKey="status" /><SortHeader label="Fecha" sortKey="createdAt" /><th>Acciones</th></tr></thead>
                <tbody>
                  {sortedRequests.map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.actor?.name || "N/A"}</td>
                      <td>{r.name}</td>
                      <td>{r.quantityOriginal || r.quantity} {r.unit} <span style={{ color: "#6b7280", fontSize: 12 }}>({r.quantityFulfilled || 0} entregados)</span></td>
                      <td><span className={`badge ${r.urgency === "critica" ? "badge-critica" : r.urgency === "alta" ? "badge-pendiente" : ""}`}>{r.urgency}</span></td>
                      <td><span className={statusBadge(r.status)}>{STATUS_LABELS[r.status] || r.status}</span></td>
                      <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>
                        {r.status === "open" && r.actorId === actor.id && (
                          <button className="btn btn-danger" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => handleCancel(r.id)}>Cancelar</button>
                        )}
                        {r.status === "open" && actor.type === "warehouse" && (
                          <button className="btn btn-primary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setEnvioForm({ requestId: r.id, quantity: String(r.quantity) })}>
                            Crear envío
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
