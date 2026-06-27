"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

const LABELS: Record<string, string> = {
  warehouse: "Almacén", relief: "Centro de Ayuda", transporter: "Transportista",
};

export default function DashboardPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [stats, setStats] = useState({ insumos: 0, solicitudes: 0, viajes: 0, viajesActivos: 0 });
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    setActor(JSON.parse(localStorage.getItem("actor") || "{}"));
    Promise.all([
      fetch("/api/insumos", { headers }).then((r) => r.json()).catch(() => []),
      fetch("/api/solicitudes", { headers }).then((r) => r.json()).catch(() => []),
      fetch("/api/viajes", { headers }).then((r) => r.json()).catch(() => []),
    ]).then(([ins, sol, via]) => {
      setStats({
        insumos: Array.isArray(ins) ? ins.length : 0,
        solicitudes: Array.isArray(sol) ? sol.length : 0,
        viajes: Array.isArray(via) ? via.length : 0,
        viajesActivos: Array.isArray(via) ? via.filter((v: any) => v.estado === "in_transit" || v.estado === "assigned").length : 0,
      });
    });
  }, [token, router]);

  if (!token) return null;

  return (
    <div>
      <Navbar />
      <div className="container">
        <div className="page-header">
          <h2>Dashboard</h2>
          <span className="badge" style={{ background: "#e2e8f0", color: "#475569", padding: "6px 14px" }}>
            {LABELS[actor.type] || actor.type}
          </span>
        </div>
        <div className="grid">
          <div className="stat-card"><h3>Insumos</h3><div className="value">{stats.insumos}</div></div>
          <div className="stat-card"><h3>Solicitudes</h3><div className="value">{stats.solicitudes}</div></div>
          <div className="stat-card"><h3>Viajes Totales</h3><div className="value">{stats.viajes}</div></div>
          <div className="stat-card"><h3>Viajes Activos</h3><div className="value">{stats.viajesActivos}</div></div>
        </div>
        <div className="card">
          <h3>Acciones rápidas</h3>
          <p style={{ marginBottom: 12, color: "#6b7280" }}>
            {actor.type === "warehouse" && "Gestiona tus insumos disponibles para que los centros de ayuda puedan solicitarlos."}
            {actor.type === "relief" && "Crea solicitudes de insumos para recibir ayuda de los almacenes registrados."}
            {actor.type === "transporter" && "Revisa los viajes disponibles y comienza a transportar insumos."}
          </p>
          {actor.type === "warehouse" && <a href="/insumos" className="btn btn-primary">Gestionar Insumos</a>}
          {actor.type === "relief" && <a href="/solicitudes" className="btn btn-primary">Crear Solicitud</a>}
          {actor.type === "transporter" && <a href="/viajes" className="btn btn-primary">Ver Viajes</a>}
        </div>
      </div>
    </div>
  );
}
