"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LABELS: Record<string, string> = {
  warehouse: "Almacén", relief: "Centro Ayuda", transporter: "Transportista",
};

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const actor = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("actor") || "{}") : {};

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("actor");
    router.push("/");
  };

  const allLinks = [
    { path: "/", label: "Mapa Central" },
    { path: "/dashboard", label: "Dashboard" },
    { path: "/insumos", label: "Insumos", roles: ["warehouse", "relief"] },
    { path: "/solicitudes", label: "Solicitudes", roles: ["warehouse", "relief"] },
    { path: "/viajes", label: "Viajes" },
    { path: "/matching", label: "Matching", roles: ["warehouse", "relief"] },
  ];

  const links = allLinks.filter((l) => !l.roles || l.roles.includes(actor.type));

  if (actor.isOwner) {
    links.push({ path: "/afiliados", label: "Afiliados" });
  }

  return (
    <nav className="navbar">
      <h1>Logística</h1>
      <button className="navbar-hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menú">
        <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
        <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
        <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
      </button>
      <div className={`navbar-overlay ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} />
      <div className={`navbar-links ${menuOpen ? "open" : ""}`}>
        {links.map((l) => (
          <Link key={l.path} href={l.path} className={pathname === l.path ? "active" : ""} onClick={() => setMenuOpen(false)}>
            {l.label}
          </Link>
        ))}
        <span className="navbar-user">
          {actor.name} ({LABELS[actor.type as string] || actor.type})
          {!actor.isOwner && <span className="navbar-member">(miembro)</span>}
        </span>
        <button className="btn btn-secondary navbar-logout" onClick={logout}>
          Salir
        </button>
      </div>
    </nav>
  );
}
