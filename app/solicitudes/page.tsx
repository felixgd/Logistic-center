"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import TableSearch from "@/components/TableSearch";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";

export default function RequestsPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [requests, setRequests] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "general", name: "", unit: "unidades", quantity: "", urgency: "media", notes: "" });
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    const a = JSON.parse(localStorage.getItem("actor") || "{}");
    setActor(a);
    if (a.type === "transporter") { router.push("/dashboard"); return; }
    fetch("/api/solicitudes", { headers }).then((r) => r.json()).then(setRequests).catch(() => {});
  }, [token, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    const res = await fetch("/api/solicitudes", { method: "POST", headers, body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setForm({ category: "general", name: "", unit: "unidades", quantity: "", urgency: "media", notes: "" });
    setShowForm(false);
    const r = await fetch("/api/solicitudes", { headers }); setRequests(await r.json());
  };

  const statusBadge = (status: string) => `badge ${({ open: "badge-pendiente", in_progress: "badge-proceso", fulfilled: "badge-completado", cancelled: "badge-cancelado" } as any)[status] || ""}`;

  const requestsMapped = requests.map((r: any) => ({ ...r, _centro: r.actor?.name || "" }));
  const filteredRequests = useSearch(requestsMapped, searchTerm, [
    "_centro", "name", "quantity", "urgency", "status", "createdAt",
  ]);
  const { sortedData: sortedRequests, SortHeader } = useSort(filteredRequests, "createdAt");

  const handleCancel = async (id: string) => {
    if (!confirm("¿Cancelar esta solicitud?")) return;
    const res = await fetch(`/api/solicitudes/${id}/estado`, { method: "PATCH", headers, body: JSON.stringify({ status: "cancelled" }) });
    if (!res.ok) { setError((await res.json()).error); return; }
    const r = await fetch("/api/solicitudes", { headers }); setRequests(await r.json());
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
                      <td>{r.quantity} {r.unit}</td>
                      <td><span className={`badge ${r.urgency === "critica" ? "badge-critica" : r.urgency === "alta" ? "badge-pendiente" : ""}`}>{r.urgency}</span></td>
                      <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                      <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>
                        {r.status === "open" && r.actorId === actor.id && (
                          <button className="btn btn-danger" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => handleCancel(r.id)}>Cancelar</button>
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
