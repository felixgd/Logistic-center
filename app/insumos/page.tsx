"use client";
import { useState, useEffect, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import TableSearch from "@/components/TableSearch";
import { distancia } from "@/lib/distancia";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { useApi, invalidateCache } from "@/lib/swr";
import { getAuthHeaders } from "@/lib/api-client";

export default function SuppliesPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [perfil, setPerfil] = useState<any>(null);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "general", name: "", unit: "unidad", quantity: "" });
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [solicitarId, setSolicitarId] = useState<string | null>(null);
  const [solicitarForm, setSolicitarForm] = useState({ quantity: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = getAuthHeaders();

  const { data: suppliesData } = useApi<any[]>(token ? "/api/insumos" : null);

  useEffect(() => {
    if (suppliesData) setSupplies(suppliesData);
  }, [suppliesData]);

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    const a = JSON.parse(localStorage.getItem("actor") || "{}");
    setActor(a);
    if (a.type === "transporter") { router.push("/dashboard"); return; }
    if (a.type === "relief") {
      fetch("/api/actores/perfil", { headers }).then(r => r.json()).then(setPerfil);
    }
  }, [token, router]);

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus();
  }, [editingId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/insumos", { method: "POST", headers, body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setForm({ category: "general", name: "", unit: "unidad", quantity: "" }); setShowForm(false);
      invalidateCache("/api/insumos");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este insumo?")) return;
    await fetch(`/api/insumos/${id}`, { method: "DELETE", headers });
    invalidateCache("/api/insumos");
  };

  const updateQuantity = async (id: string, mode: "add" | "set", value: number, version?: number) => {
    const body: any = { mode };
    if (mode === "add") body.delta = value;
    else { body.quantity = value; body.version = version; }
    const res = await fetch(`/api/insumos/${id}`, { method: "PUT", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Error al actualizar cantidad");
      invalidateCache("/api/insumos");
      return false;
    }
    setError("");
    invalidateCache("/api/insumos");
    return true;
  };

  const handleCrearViaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitarId || submitting) return;
    const supply = supplies.find(s => s.id === solicitarId);
    if (!supply) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/viajes", {
        method: "POST", headers,
        body: JSON.stringify({
          warehouseActorId: supply.actorId,
          reliefActorId: actor.id,
          items: [{ name: supply.name, quantity: Number(solicitarForm.quantity), unit: supply.unit, supplyId: supply.id }],
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      setSolicitarId(null);
      setSolicitarForm({ quantity: "" });
      invalidateCache("/api/insumos");
      invalidateCache("/api/viajes");
    } finally {
      setSubmitting(false);
    }
  };

  const isRelief = actor.type === "relief";

  const supplyRows = isRelief
    ? Object.entries(
        supplies.reduce((acc: any, s: any) => {
          const key = s.name.toLowerCase();
          if (!acc[key]) acc[key] = { name: s.name, unit: s.unit, items: [] };
          acc[key].items.push(s);
          return acc;
        }, {})
      ).map(([_, g]: any) => {
        const totalQuantity = g.items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
        const totalReserved = g.items.reduce((sum: number, i: any) => sum + (i.quantityReserved || 0), 0);
        const disponible = Math.max(totalQuantity - totalReserved, 0);
        return {
          name: g.name,
          unit: g.unit,
          totalQuantity,
          totalReserved,
          disponible,
          items: g.items,
          _estado: disponible > 0 ? "Disponible" : totalReserved > 0 ? "Reservado" : "Agotado",
        };
      })
    : supplies.map((s: any) => {
        const totalQuantity = s.quantity;
        const totalReserved = s.quantityReserved || 0;
        const disponible = Math.max(totalQuantity - totalReserved, 0);
        return {
          name: s.name,
          unit: s.unit,
          totalQuantity,
          totalReserved,
          disponible,
          items: [s],
          supplyId: s.id,
          version: s.version,
          _estado: disponible > 0 ? "Disponible" : totalReserved > 0 ? "Reservado" : "Agotado",
        };
      });

  const filteredSupplyRows = useSearch(supplyRows, searchTerm, [
    "name", "disponible", "totalQuantity", "totalReserved", "unit", "_estado",
  ]);
  const { sortedData: sortedSupplyRows, SortHeader } = useSort(filteredSupplyRows, "name");

  return (
    <div>
      <Navbar />
      <div className="container">
        <div className="page-header">
          <h2>Insumos</h2>
          {actor.type === "warehouse" && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuevo Insumo</button>}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Registrar Insumo</h3>
              <form onSubmit={handleCreate}>
                <div className="form-group"><label>Categoría</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    <option value="general">General</option><option value="agua">Agua</option><option value="alimentos">Alimentos</option>
                    <option value="medicinas">Medicinas</option><option value="ropa">Ropa</option><option value="herramientas">Herramientas</option>
                  </select>
                </div>
                <div className="form-group"><label>Nombre</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
                <div className="form-group"><label>Cantidad</label><input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} required min="1" /></div>
                <div className="form-group"><label>Unidad</label>
                  <select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                    <option value="unidades">Unidades</option><option value="kg">Kilogramos</option><option value="litros">Litros</option><option value="cajas">Cajas</option><option value="paquetes">Paquetes</option><option value="palets">Palets</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={submitting}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Guardando..." : "Guardar"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {solicitarId && (
          <div className="modal-overlay" onClick={() => setSolicitarId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Crear Viaje</h3>
              <p style={{ marginBottom: 12, color: "#475569" }}>
                {supplies.find(s => s.id === solicitarId)?.name} — {supplies.find(s => s.id === solicitarId)?.actor?.name}
              </p>
              <form onSubmit={handleCrearViaje}>
                <div className="form-group"><label>Cantidad</label><input type="number" value={solicitarForm.quantity} onChange={(e) => setSolicitarForm((f) => ({ ...f, quantity: e.target.value }))} required min="1" max={Math.max((supplies.find(s => s.id === solicitarId)?.quantity || 0) - (supplies.find(s => s.id === solicitarId)?.quantityReserved || 0), 0)} /></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSolicitarId(null)} disabled={submitting}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Creando..." : "Crear Viaje"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {supplies.length === 0 ? (
          <div className="card empty-state"><h3>No hay insumos registrados</h3><p>Los almacenes pueden registrar insumos disponibles.</p></div>
        ) : (
          <div className="card">
            <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar insumo..." />
            {sortedSupplyRows.length === 0 ? (
              <p style={{ color: "#9ca3af", padding: "12px 0" }}>No se encontraron insumos con "{searchTerm}".</p>
            ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <SortHeader label="Insumo" sortKey="name" />
                    <SortHeader label="Disponible" sortKey="disponible" />
                    <SortHeader label="Reservado" sortKey="totalReserved" />
                    <SortHeader label="Unidad" sortKey="unit" />
                    <SortHeader label="Estado" sortKey="_estado" />
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSupplyRows.map((g: any) => {
                    const badgeClass = g.disponible > 0 ? "badge-completado" : g.totalReserved > 0 ? "badge-pendiente" : "badge-cancelado";
                    const badgeLabel = g.disponible > 0 ? "Disponible" : g.totalReserved > 0 ? "Reservado" : "Agotado";
                    const groupKey = isRelief ? g.name : g.supplyId;
                    const expanded = detalleId === groupKey;
                    return (
                    <Fragment key={groupKey}>
                    <tr>
                      <td>{g.name}</td>
                      <td>
                        {actor.type === "warehouse" ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 12, minWidth: 28, borderRadius: 4 }}
                              onClick={() => updateQuantity(g.supplyId, "add", -1)} disabled={g.totalQuantity <= 0}>−</button>
                            {editingId === g.supplyId ? (
                              <input ref={inputRef} type="number" min="0" value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={async () => {
                                  const v = Number(editValue);
                                  if (!isNaN(v) && v >= 0 && v !== g.totalQuantity) {
                                    await updateQuantity(g.supplyId, "set", v, g.version);
                                  }
                                  setEditingId(null);
                                }}
                                onKeyDown={async (e) => {
                                  if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
                                  if (e.key === "Escape") { setEditingId(null); }
                                }}
                                style={{ width: 70, textAlign: "center", padding: "2px 4px" }} />
                            ) : (
                              <span onClick={() => { setEditingId(g.supplyId); setEditValue(String(g.totalQuantity)); }}
                                style={{ cursor: "pointer", padding: "2px 8px", minWidth: 40, textAlign: "center", display: "inline-block", borderBottom: "1px dashed #94a3b8" }}>
                                {g.disponible}
                              </span>
                            )}
                            <button className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 12, minWidth: 28, borderRadius: 4 }}
                              onClick={() => updateQuantity(g.supplyId, "add", 1)}>+</button>
                          </span>
                        ) : (
                          g.disponible
                        )}
                      </td>
                      <td><span style={{ color: "var(--text-muted)", fontSize: 14 }}>{g.totalReserved}</span></td>
                      <td>{g.unit}</td>
                      <td><span className={`badge ${badgeClass}`}>{badgeLabel}</span></td>
                      <td>
                        {isRelief && (
                          <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setDetalleId(expanded ? null : groupKey)}>
                            {expanded ? "Cerrar" : "Detalle"}
                          </button>
                        )}
                        {actor.type === "warehouse" && (
                          <button className="btn btn-danger" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => handleDelete(g.supplyId)}>Eliminar</button>
                        )}
                      </td>
                    </tr>
                    {expanded && isRelief && (
                      <tr>
                        <td colSpan={6} style={{ padding: "0 16px 16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {g.items.map((item: any) => {
                              const dist = perfil ? distancia(perfil.lat, perfil.lng, item.actor?.lat, item.actor?.lng) : null;
                              return (
                              <div key={item.id} style={{ background: "#f8fafc", borderRadius: 8, padding: 12, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                                <div style={{ minWidth: 160 }}>
                                  <strong>{item.actor?.name}</strong>
                                  <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                                    <div>Ubicación: {[item.actor?.address, item.actor?.city].filter(Boolean).join(", ")}</div>
                                    <div>Distancia: {dist !== null ? `${dist} km` : "—"}</div>
                                    <div>Disponible: <strong>{Math.max((item.quantity || 0) - (item.quantityReserved || 0), 0)}</strong> {item.unit}</div>
                                    <div>Reservado: <strong>{item.quantityReserved || 0}</strong> {item.unit}</div>
                                  </div>
                                </div>
                                {item.quantity > 0 && (
                                  <button className="btn btn-primary" style={{ alignSelf: "center", marginLeft: "auto" }}
                                    onClick={() => { setSolicitarId(item.id); setSolicitarForm({ quantity: "" }); }}
                                    disabled={submitting}>
                                    Solicitar
                                  </button>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
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
