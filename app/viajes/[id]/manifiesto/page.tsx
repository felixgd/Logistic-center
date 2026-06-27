"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import NavegacionViaje from "@/components/NavegacionViaje";
import TableSearch from "@/components/TableSearch";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";

export default function ManifiestoPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actor, setActor] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    setActor(JSON.parse(localStorage.getItem("actor") || "{}"));
    if (!id) return;
    fetch(`/api/viajes/${id}/manifiesto`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => alert("Error al cargar manifiesto"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!confirm("¿Cancelar este viaje?")) return;
    const res = await fetch(`/api/viajes/${id}/estado`, { method: "PATCH", headers, body: JSON.stringify({ status: "cancelled" }) });
    if (!res.ok) { alert((await res.json()).error); return; }
    router.push("/viajes");
  };

  const manifiestoMapped = (data?.manifiesto || []).map((item: any, i: number) => ({ ...item, _num: i + 1 }));
  const filteredManifiesto = useSearch(manifiestoMapped, searchTerm, [
    "_num", "insumo", "cantidad", "unidad",
  ]);
  const { sortedData: sortedManifiesto, SortHeader } = useSort(filteredManifiesto, "_num");

  const formatDate = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "—";

  if (loading) return <div><Navbar /><div className="container"><p>Cargando...</p></div></div>;
  if (!data) return <div><Navbar /><div className="container"><p>No encontrado</p></div></div>;

  return (
    <div>
      <Navbar />
      <div className="container">
        <div className="page-header">
          <h2>Manifiesto de Viaje</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {data.estado === "proposed" && (actor.id === data.puntoCarga?.id || actor.id === data.puntoDescarga?.id) && (
              <button className="btn btn-danger" onClick={handleCancel}>Cancelar Viaje</button>
            )}
            <button className="btn btn-secondary" onClick={() => router.push("/viajes")}>Volver</button>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, color: "#1e293b" }}>{data.codigoViaje}</h1>
            <span className={`badge ${data.estado === "delivered" ? "badge-completado" : data.estado === "in_transit" ? "badge-proceso" : "badge-pendiente"}`} style={{ fontSize: 14, padding: "6px 16px" }}>{data.estado}</span>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", fontSize: 13, color: "#6b7280" }}>
              <span><strong>Creado:</strong> {formatDate(data.createdAt)}</span>
              <span><strong>Última actualización:</strong> {formatDate(data.updatedAt)}</span>
            </div>
          </div>
          {data.transportista && (
            <div style={{ background: "#f0fdf4", padding: 12, borderRadius: 6, marginBottom: 16, border: "1px solid #bbf7d0" }}>
              <strong>Transportista:</strong> {data.transportista.name} - {data.transportista.whatsapp}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div style={{ background: "#eff6ff", padding: 16, borderRadius: 8, border: "1px solid #bfdbfe" }}>
              <h4 style={{ color: "#1e40af", marginBottom: 8 }}>Punto de Carga</h4>
              <p><strong>{data.puntoCarga.nombre}</strong></p>
              <p style={{ color: "#6b7280", fontSize: 14 }}>{data.puntoCarga.direccion}</p>
              <p style={{ color: "#6b7280", fontSize: 14 }}>{data.puntoCarga.contacto}</p>
            </div>
            <div style={{ background: "#fef2f2", padding: 16, borderRadius: 8, border: "1px solid #fecaca" }}>
              <h4 style={{ color: "#991b1b", marginBottom: 8 }}>Punto de Descarga</h4>
              <p><strong>{data.puntoDescarga.nombre}</strong></p>
              <p style={{ color: "#6b7280", fontSize: 14 }}>{data.puntoDescarga.direccion}</p>
              <p style={{ color: "#6b7280", fontSize: 14 }}>{data.puntoDescarga.contacto}</p>
            </div>
          </div>
          {(data.estado === "assigned" || data.estado === "in_transit") && (
            <div style={{ marginBottom: 24, padding: 16, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
              <h4 style={{ marginBottom: 8, color: "#92400e" }}>Ruta sugerida</h4>
              <p style={{ fontSize: 13, color: "#92400e", marginBottom: 8 }}>Tu ubicacion → {data.puntoCarga.nombre} → {data.puntoDescarga.nombre}</p>
              <NavegacionViaje origen={data.puntoCarga} destino={data.puntoDescarga} />
            </div>
          )}
          <h3 style={{ marginBottom: 12 }}>Manifiesto de Carga</h3>
          <TableSearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar en manifiesto..." />
          {sortedManifiesto.length === 0 ? (
            <p style={{ color: "#9ca3af", padding: "12px 0" }}>No se encontraron ítems con "{searchTerm}".</p>
          ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><SortHeader label="#" sortKey="_num" /><SortHeader label="Insumo" sortKey="insumo" /><SortHeader label="Cantidad" sortKey="cantidad" /><SortHeader label="Unidad" sortKey="unidad" /></tr></thead>
              <tbody>
                {sortedManifiesto.map((item: any, i: number) => (
                  <tr key={i}><td>{item._num}</td><td>{item.insumo}</td><td>{item.cantidad}</td><td>{item.unidad}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          <div style={{ marginTop: 24, padding: 16, background: "#f9fafb", borderRadius: 6, border: "1px dashed #d1d5db" }}>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: 13 }}>Manifiesto generado el {formatDate(data.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
