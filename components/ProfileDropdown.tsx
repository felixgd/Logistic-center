"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  CaretDown, 
  SignOut, 
  Package, 
  Truck, 
  Heart,
  Plus,
  Sun,
  Moon,
  Trash,
  WarningCircle
} from "@phosphor-icons/react";
import { getAuthHeaders, setCsrfToken, clearCsrfToken } from "@/lib/api-client";

const LABELS: Record<string, string> = {
  warehouse: "Almacén",
  relief: "Centro Ayuda",
  transporter: "Transportista",
};

interface Actor {
  id: string;
  name: string;
  type: string;
  isOwner?: boolean;
}

interface ProfileDropdownProps {
  actor: Actor;
  availableActors: Actor[];
  canCreateProfile: boolean;
  onLogout: () => void;
}

export default function ProfileDropdown({
  actor,
  availableActors,
  canCreateProfile,
  onLogout,
}: ProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sync state with HTML attribute on mount
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(currentTheme);

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/actores/delete-account", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al eliminar la cuenta");
        setDeleting(false);
        return;
      }
      localStorage.removeItem("token");
      localStorage.removeItem("actor");
      clearCsrfToken();
      window.location.href = "/";
    } catch {
      alert("Error al eliminar la cuenta");
      setDeleting(false);
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const handleSwitch = async (targetActorId: string) => {
    if (targetActorId === actor.id) return;
    try {
      const res = await fetch("/api/actores/switch", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ actorId: targetActorId }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("token", data.token);
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
        localStorage.setItem("actor", JSON.stringify(data.actor));
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Error switching actor:", err);
    }
  };

  const getActorIcon = (type: string) => {
    switch (type) {
      case "warehouse":
        return <Package size={16} />;
      case "transporter":
        return <Truck size={16} />;
      case "relief":
      default:
        return <Heart size={16} />;
    }
  };

  const initial = actor.name ? actor.name.trim().charAt(0).toUpperCase() : "?";

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Profile Trigger Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="profile-trigger-btn"
        style={{
          background: "transparent",
          border: "1px solid transparent",
          padding: "4px 8px",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          transition: "all 0.2s",
          outline: "none",
        }}
      >
        {/* User Initials Avatar */}
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: "var(--text-main)",
            color: "var(--bg-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            fontWeight: "700",
          }}
        >
          {initial}
        </div>

        {/* User Label details */}
        <div className="profile-text-info" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-main)" }}>
            {actor.name}
          </span>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-muted)" }}>
            {LABELS[actor.type] || actor.type}
          </span>
        </div>

        <CaretDown className="profile-caret-icon" size={14} color="currentColor" style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {/* Popover Menu Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "240px",
            background: "var(--bg-card)",
            borderRadius: "12px",
            border: "1px solid var(--border-dark)",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.08)",
            zIndex: 99999,
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <span
            style={{
              fontSize: "9px",
              fontWeight: "800",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "6px 8px 4px 8px",
              display: "block",
            }}
          >
            Cambiar Perfil
          </span>

          {availableActors.map((a) => {
            const isActive = a.id === actor.id;
            return (
              <button
                key={a.id}
                onClick={() => {
                  handleSwitch(a.id);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "none",
                  background: isActive ? "var(--border-color)" : "transparent",
                  color: isActive ? "var(--text-main)" : "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: isActive ? "700" : "600",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                className={isActive ? "" : "hover-gray-bg"}
              >
                <span style={{ color: isActive ? "var(--text-main)" : "var(--text-muted)", display: "flex", alignItems: "center" }}>
                  {getActorIcon(a.type)}
                </span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.name}
                </span>
              </button>
            );
          })}

          {canCreateProfile && (
            <Link
              href="/dashboard?create_profile=true"
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "8px",
                color: "#3b82f6",
                fontSize: "12px",
                fontWeight: "600",
                textDecoration: "none",
                transition: "background 0.2s",
              }}
              className="hover-gray-bg"
            >
              <Plus size={14} weight="bold" />
              Crear perfil nuevo
            </Link>
          )}

          <div style={{ height: "1px", backgroundColor: "var(--border-color)", margin: "4px 0" }} />

          {/* Theme toggle option */}
          <button
            onClick={toggleTheme}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: "var(--text-main)",
              fontSize: "12px",
              fontWeight: "600",
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            className="hover-gray-bg"
          >
            <span style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </span>
            <span>Tema: {theme === "dark" ? "Oscuro" : "Claro"}</span>
          </button>

          <div style={{ height: "1px", backgroundColor: "var(--border-color)", margin: "4px 0" }} />

          <button
            onClick={() => {
              onLogout();
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: "var(--accent-red-text)",
              fontSize: "12px",
              fontWeight: "700",
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            className="hover-red-bg"
          >
            <SignOut size={16} />
            Cerrar Sesión
          </button>

          <div style={{ height: "1px", backgroundColor: "var(--border-color)", margin: "4px 0" }} />

          <button
            onClick={() => {
              setOpen(false);
              setShowDeleteConfirm(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: "var(--accent-red-text)",
              fontSize: "12px",
              fontWeight: "700",
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            className="hover-red-bg"
          >
            <Trash size={16} />
            Dar de baja
          </button>
        </div>
      )}

      {/* Delete account confirmation modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999999,
          }}
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "380px",
              width: "90%",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <WarningCircle size={40} weight="fill" style={{ color: "#dc2626", marginBottom: 12 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--text-main)" }}>
              Dar de baja cuenta
            </h3>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px", lineHeight: 1.5 }}>
              Esta acción eliminará toda tu información y la de tus perfiles asociados (almacenes, centros de ayuda, transportistas). <strong>No se puede revertir.</strong>
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1 }}
                disabled={deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? "Eliminando..." : "Confirmar y eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
