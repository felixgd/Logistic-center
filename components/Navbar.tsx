"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LABELS: Record<string, string> = {
  warehouse: "Almacén", relief: "Centro Ayuda", transporter: "Transportista",
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const actor = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("actor") || "{}") : {};

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("actor");
    router.push("/login");
  };

  const links = [
    { path: "/", label: "Mapa Central" },
    { path: "/dashboard", label: "Dashboard" },
    { path: "/insumos", label: "Insumos" },
    { path: "/solicitudes", label: "Solicitudes" },
    { path: "/viajes", label: "Viajes" },
    { path: "/matching", label: "Matching" },
  ];

  if (actor.isOwner) {
    links.push({ path: "/afiliados", label: "Afiliados" });
  }

  return (
    <nav className="navbar">
      <h1>Logística</h1>
      <nav>
        {links.map((l) => (
          <Link key={l.path} href={l.path} className={pathname === l.path ? "active" : ""}>
            {l.label}
          </Link>
        ))}
        <span style={{ color: "#94a3b8", margin: "0 12px", fontSize: 13 }}>
          {actor.name} ({LABELS[actor.type as string] || actor.type})
          {!actor.isOwner && <span style={{ color: "#f59e0b", marginLeft: 6 }}>(miembro)</span>}
        </span>
        <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={logout}>
          Salir
        </button>
      </nav>
    </nav>
  );
}
