"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LABELS: Record<string, string> = {
  warehouse: "Almacén", relief: "Centro Ayuda", transporter: "Transportista",
};

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [availableActors, setAvailableActors] = useState<any[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedActor = localStorage.getItem("actor");
    if (storedActor) {
      try {
        setActor(JSON.parse(storedActor));
      } catch (e) {
        console.error("Error parsing actor", e);
      }
    }

    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("/api/actores/list", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAvailableActors(data);
        }
      })
      .catch((e) => console.error("Error fetching available actors", e));
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("actor");
    router.push("/");
  };

  if (!mounted) {
    return (
      <nav className="navbar">
        <h1>Logística</h1>
      </nav>
    );
  }

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
        {availableActors.length > 0 && (
          <select 
            value={actor.id} 
            onChange={async (e) => {
              const targetActorId = e.target.value;
              if (targetActorId === "create_new_profile") {
                window.location.href = "/dashboard?create_profile=true";
                return;
              }
              const token = localStorage.getItem("token");
              try {
                const res = await fetch("/api/actores/switch", {
                  method: "POST",
                  headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                  },
                  body: JSON.stringify({ actorId: targetActorId }),
                });
                if (res.ok) {
                  const data = await res.json();
                  localStorage.setItem("token", data.token);
                  localStorage.setItem("actor", JSON.stringify(data.actor));
                  window.location.href = "/dashboard";
                }
              } catch (err) {
                console.error("Error switching actor:", err);
              }
            }}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              borderRadius: "4px",
              backgroundColor: "#334155",
              color: "#fff",
              border: "1px solid #475569",
              cursor: "pointer",
              outline: "none",
              margin: "4px 8px"
            }}
          >
            {availableActors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.type === "warehouse" ? "Almacén" : a.type === "relief" ? "Ayuda" : "Transporte"})
              </option>
            ))}
            <option value="create_new_profile">➕ Crear nuevo perfil...</option>
          </select>
        )}
        <button className="btn btn-secondary navbar-logout" onClick={logout}>
          Salir
        </button>
      </div>
    </nav>
  );
}
