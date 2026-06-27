"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function SuppliesPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [supplies, setSupplies] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "general", name: "", unit: "unidad", quantity: "" });
  const [error, setError] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    setActor(JSON.parse(localStorage.getItem("actor") || "{}"));
    fetch("/api/insumos", { headers }).then((r) => r.json()).then(setSupplies).catch(() => {});
  }, [token, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    const res = await fetch("/api/insumos", { method: "POST", headers, body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setForm({ category: "general", name: "", unit: "unidad", quantity: "" }); setShowForm(false);
    const r = await fetch("/api/insumos", { headers }); setSupplies(await r.json());
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este insumo?")) return;
    await fetch(`/api/insumos/${id}`, { method: "DELETE", headers });
    const r = await fetch("/api/insumos", { headers }); setSupplies(await r.json());
  };

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
                    <option value="unidades">Unidades</option><option value="kg">Kilogramos</option><option value="litros">Litros</option><option value="cajas">Cajas</option><option value="palets">Palets</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {supplies.length === 0 ? (
          <div className="card empty-state"><h3>No hay insumos registrados</h3><p>Los almacenes pueden registrar insumos disponibles.</p></div>
        ) : (
          <div className="card">
            <table>
              <thead><tr><th>Insumo</th><th>Cantidad</th><th>Unidad</th><th>Estado</th>{actor.type === "warehouse" && <th>Acciones</th>}</tr></thead>
              <tbody>
                {supplies.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.name}</td><td>{s.quantity}</td><td>{s.unit}</td>
                    <td><span className={`badge ${s.status === "available" ? "badge-completado" : "badge-cancelado"}`}>{s.status === "available" ? "Disponible" : "Reservado"}</span></td>
                    {actor.type === "warehouse" && (
                      <td><button className="btn btn-danger" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => handleDelete(s.id)}>Eliminar</button></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
