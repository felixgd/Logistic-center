"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import { getAuthHeaders, clearCsrfToken } from "@/lib/api-client";
import { 
  Plus,
  Compass,
  Layout,
  Package,
  ClipboardText,
  Truck,
  Handshake,
  Users
} from "@phosphor-icons/react";
import ProfileDropdown from "@/components/ProfileDropdown";

const LABELS: Record<string, string> = {
  warehouse: "Almacén",
  relief: "Centro Ayuda",
  transporter: "Transportista",
};

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [availableActors, setAvailableActors] = useState<any[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);

    if (token) {
      const storedActor = localStorage.getItem("actor");
      if (storedActor) {
        try {
          setActor(JSON.parse(storedActor));
        } catch (e) {
          console.error("Error parsing actor", e);
        }
      }

      fetch("/api/actores/list", {
        headers: getAuthHeaders()
      })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAvailableActors(data);
          }
        })
        .catch((e) => console.error("Error fetching available actors", e));
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("actor");
    clearCsrfToken();
    setIsAuthenticated(false);
    setActor({});
    setAvailableActors([]);
    router.push("/");
  };

  if (!mounted) {
    return (
      <nav className="navbar">
        <Link href="/" className="navbar-logo" style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={24} weight="bold" style={{ color: "#22c55e" }} />
          <strong style={{ letterSpacing: "-0.015em", fontSize: 16 }}>Logística en Crisis</strong>
        </Link>
      </nav>
    );
  }

  // Define links based on authentication state and actor roles
  const allLinks = [
    { path: "/", label: "Mapa Central", icon: <Compass size={16} /> },
    { path: "/dashboard", label: "Dashboard", requireAuth: true, icon: <Layout size={16} /> },
    { path: "/insumos", label: "Insumos", roles: ["warehouse", "relief"], requireAuth: true, icon: <Package size={16} /> },
    { path: "/solicitudes", label: "Solicitudes", roles: ["warehouse", "relief"], requireAuth: true, icon: <ClipboardText size={16} /> },
    { path: "/viajes", label: "Viajes", requireAuth: true, icon: <Truck size={16} /> },
    { path: "/matching", label: "Coordinación", roles: ["warehouse"], requireAuth: true, icon: <Handshake size={16} /> },
  ];

  const filteredLinks = allLinks.filter((l) => {
    if (l.requireAuth && !isAuthenticated) return false;
    if (l.roles && actor && !l.roles.includes(actor.type)) return false;
    return true;
  });

  if (isAuthenticated && actor && actor.isOwner && actor.type !== "transporter") {
    filteredLinks.push({ path: "/afiliados", label: "Voluntarios", icon: <Users size={16} /> });
  }

  const ownedTypes = new Set(availableActors.filter((a) => a.isOwner).map((a) => a.type));
  const canCreateProfile = ownedTypes.size < 3;

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-logo" style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
        <Plus size={24} weight="bold" style={{ color: "#22c55e" }} />
        <strong style={{ letterSpacing: "-0.015em", fontSize: 16 }}>Logística en Crisis</strong>
      </Link>
      
      <button className="navbar-hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menú">
        <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
        <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
        <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
      </button>

      <div className={`navbar-overlay ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} />
      
      <div className={`navbar-links ${menuOpen ? "open" : ""}`}>
        {filteredLinks.map((l) => (
          <Link 
            key={l.path} 
            href={l.path} 
            className={pathname === l.path ? "active" : ""} 
            onClick={() => setMenuOpen(false)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            {l.icon}
            <span>{l.label}</span>
          </Link>
        ))}

        {isAuthenticated ? (
          <>
            <NotificationBell />
            {actor && actor.name && (
              <ProfileDropdown
                actor={actor}
                availableActors={availableActors}
                canCreateProfile={canCreateProfile}
                onLogout={logout}
              />
            )}
          </>
        ) : (
          <div className="auth-buttons-header" style={{ display: "flex", gap: 8, marginLeft: 12 }}>
            <Link href="/login" className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setMenuOpen(false)}>
              Ingresar
            </Link>
            <Link href="/register" className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setMenuOpen(false)}>
              Registrarse
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
