"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import QrModal from "@/components/QrModal";
import TableSearch from "@/components/TableSearch";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";

export default function AfiliadosPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [members, setMembers] = useState<any[]>([]);
  const [editMember, setEditMember] = useState<any>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [qrData, setQrData] = useState<{ url: string; code: string; actorName: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    const res = await fetch("/api/actores/afiliar/miembros", { headers });
    if (res.status === 403) { setError("Solo el administrador principal puede gestionar afiliados"); return; }
    if (!res.ok) { router.push("/login"); return; }
    setMembers(await res.json());
  };

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    const a = JSON.parse(localStorage.getItem("actor") || "{}");
    setActor(a);
    if (a.type === "transporter") { router.push("/dashboard"); return; }
    load();
  }, [token, router]);

  const openEdit = (m: any) => {
    setEditMember(m);
    setForm({ name: m.name, email: m.email, phone: m.phone || "" });
    setError("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/actores/afiliar/miembros/${editMember.id}`, {
      method: "PATCH", headers, body: JSON.stringify(form),
    });
    if (!res.ok) { setError((await res.json()).error); return; }
    setEditMember(null); load();
  };

  const generarCodigo = async () => {
    setError("");
    const res = await fetch("/api/actores/afiliar/codigo", { method: "POST", headers });
    if (!res.ok) { setError((await res.json()).error); return; }
    setQrData(await res.json());
  };

  const filteredMembers = useSearch(members, searchTerm, ["name", "email", "phone", "role"]);
  const { sortedData: sortedMembers, SortHeader } = useSort(filteredMembers, "name");

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar a "${name}"? Esta acción no se puede deshacer.`)) return;
    setError("");
    const res = await fetch(`/api/actores/afiliar/miembros/${id}`, { method: "DELETE", headers });
    if (!res.ok) { setError((await res.json()).error); return; }
    load();
  };

  return (
    <div>
      <Navbar />
      <div className="container">
        <div className="page-header">
          <h2>Afiliados</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "#6b7280", fontSize: 14 }}>{members.length} miembros</span>
            <button className="btn btn-primary" onClick={generarCodigo}>+ Código QR</button>
          </div>
        </div>
        {qrData && <QrModal url={qrData.url} actorName={qrData.actorName} code={qrData.code} onClose={() => setQrData(null)} />}
        {error && <div className="alert alert-error">{error}</div>}
        {members.length === 0 ? (
          <div className="card empty-state">
            <h3>No hay afiliados</h3>
            <p>Usa el código QR desde el Dashboard para invitar personal a este {actor.type === "warehouse" ? "almacén" : "centro de ayuda"}.</p>
          </div>
        ) : (
          <div className="card">
            <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar afiliado..." />
            {sortedMembers.length === 0 ? (
              <p style={{ color: "#9ca3af", padding: "12px 0" }}>No se encontraron afiliados con "{searchTerm}".</p>
            ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><SortHeader label="Nombre" sortKey="name" /><SortHeader label="Email" sortKey="email" /><SortHeader label="Teléfono" sortKey="phone" /><SortHeader label="Rol" sortKey="role" /><SortHeader label="Desde" sortKey="createdAt" /><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{m.email}</td>
                      <td>{m.phone || "—"}</td>
                      <td><span className="badge badge-proceso">{m.role}</span></td>
                      <td style={{ fontSize: 13, color: "#6b7280" }}>{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, marginRight: 4 }} onClick={() => openEdit(m)}>Editar</button>
                        <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => handleDelete(m.id, m.name)}>Eliminar</button>
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
      {editMember && (
        <div className="modal-overlay" onClick={() => setEditMember(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Editar Afiliado</h3>
            <form onSubmit={handleEdit}>
              <div className="form-group"><label>Nombre</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required /></div>
              <div className="form-group"><label>Teléfono</label><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="521234567890" /></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditMember(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
