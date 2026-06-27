"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function ManifiestoPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/viajes/${id}/manifiesto`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => alert("Error al cargar manifiesto"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div><Navbar /><div className="container"><p>Cargando...</p></div></div>;
  if (!data) return <div><Navbar /><div className="container"><p>No encontrado</p></div></div>;

  return (
    <div>
      <Navbar />
      <div className="container">
        <div className="page-header">
          <h2>Manifiesto de Viaje</h2>
          <button className="btn btn-secondary" onClick={() => router.push("/viajes")}>Volver</button>
        </div>
        <div className="card" style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, color: "#1e293b" }}>{data.codigoViaje}</h1>
            <span className={`badge ${data.estado === "delivered" ? "badge-completado" : data.estado === "in_transit" ? "badge-proceso" : "badge-pendiente"}`} style={{ fontSize: 14, padding: "6px 16px" }}>{data.estado}</span>
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
          <h3 style={{ marginBottom: 12 }}>Manifiesto de Carga</h3>
          <table>
            <thead><tr><th>#</th><th>Insumo</th><th>Cantidad</th><th>Unidad</th></tr></thead>
            <tbody>
              {data.manifiesto.map((item: any, i: number) => (
                <tr key={i}><td>{i + 1}</td><td>{item.insumo}</td><td>{item.cantidad}</td><td>{item.unidad}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 24, padding: 16, background: "#f9fafb", borderRadius: 6, border: "1px dashed #d1d5db" }}>
            <p style={{ textAlign: "center", color: "#6b7280", fontSize: 13 }}>Fecha: {new Date(data.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
