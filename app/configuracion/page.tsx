"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { COUNTRY_CODES } from "@/components/CountryCodeSelect";
import { getAuthHeaders } from "@/lib/api-client";
import {
  User,
  Shield,
  FileText,
  Trash,
  Warning,
  Check,
  X,
  Sun,
  Moon,
  SignOut,
  CaretLeft,
  CaretRight
} from "@phosphor-icons/react";

const normalizePhone = (value: string) => value.replace(/\D/g, "");

function splitCountryCode(phone: string): { countryCode: string; local: string } {
  const digits = normalizePhone(phone);
  for (const c of COUNTRY_CODES) {
    const codeDigits = normalizePhone(c.code);
    if (digits.startsWith(codeDigits)) {
      return { countryCode: c.code, local: digits.slice(codeDigits.length) };
    }
  }
  return { countryCode: "+52", local: digits };
}

type SettingsTab = "perfil" | "preferencias" | "legal" | "cuenta";

export default function ConfiguracionPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<SettingsTab>("perfil");
  const [mobileTabOpen, setMobileTabOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Profile form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCountryCode, setFormCountryCode] = useState("+57");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formVehicleType, setFormVehicleType] = useState("");
  const [formCapacityKg, setFormCapacityKg] = useState("");

  // Theme
  const [theme, setTheme] = useState("light");

  // Delete account
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!t) { router.push("/login"); return; }
    setToken(t);

    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(currentTheme);

    fetch("/api/actores/perfil", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.id) {
          setActor(data);
          setUser(data);
          setFormName(data.name || "");
          setFormEmail(data.email || "");
          setFormAddress(data.address || "");
          setFormCity(data.city || "");

          // Parse phone into country code + local
          const { countryCode, local } = splitCountryCode(data.whatsapp || data.phone || "");
          setFormCountryCode(countryCode);
          setFormPhone(local);

          setFormVehicleType(data.vehicleType || "");
          setFormCapacityKg(data.capacityKg ? String(data.capacityKg) : "");
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const fullPhone = formCountryCode.replace(/\D/g, "") + formPhone.replace(/\D/g, "");
      const res = await fetch("/api/actores/perfil", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          email: formEmail || null,
          whatsapp: fullPhone,
          phone: fullPhone,
          address: formAddress,
          city: formCity,
          vehicleType: formVehicleType || null,
          capacityKg: formCapacityKg ? Number(formCapacityKg) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al guardar");
        return;
      }

      // Update localStorage actor
      if (data.actor) {
        const stored = JSON.parse(localStorage.getItem("actor") || "{}");
        localStorage.setItem("actor", JSON.stringify({ ...stored, ...data.actor }));
      }

      showMessage("success", "Perfil actualizado correctamente");
    } catch {
      showMessage("error", "Error de red al guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/actores/delete-account", { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) {
        const data = await res.json();
        showMessage("error", data.error || "Error al eliminar cuenta");
        setDeleting(false);
        return;
      }
      localStorage.removeItem("token");
      localStorage.removeItem("actor");
      router.push("/");
    } catch {
      showMessage("error", "Error de red al eliminar");
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("actor");
    router.push("/");
  };

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: "perfil", label: "Mi Perfil", icon: <User size={18} /> },
    { key: "preferencias", label: "Preferencias", icon: <Shield size={18} /> },
    { key: "legal", label: "Privacidad y Terminos", icon: <FileText size={18} /> },
    { key: "cuenta", label: "Cuenta", icon: <Trash size={18} /> },
  ];

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 48 }}>
      <Navbar />
      <div className="container">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, marginBottom: 24 }}>
          <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => router.back()}>
            <CaretLeft size={14} /> Volver
          </button>
          <h2 style={{ margin: 0 }}>Configuracion</h2>
        </div>

        {message && (
          <div style={{
            padding: "12px 16px", borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8,
            background: message.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            color: message.type === "success" ? "#10b981" : "#ef4444",
            border: `1px solid ${message.type === "success" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
          }}>
            {message.type === "success" ? <Check size={16} /> : <X size={16} />}
            {message.text}
          </div>
        )}

        {/* Mobile tab selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }} className="settings-mobile-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`btn ${tab === t.key ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "8px 14px", fontSize: 12, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setTab(t.key)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          {/* Desktop sidebar */}
          <div className="settings-sidebar" style={{
            width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4,
          }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, textAlign: "left", cursor: "pointer",
                  background: tab === t.key ? "rgba(16,185,129,0.1)" : "transparent",
                  color: tab === t.key ? "#10b981" : "var(--text-muted)",
                  transition: "all 0.2s",
                }}
                className={tab === t.key ? "" : "hover-gray-bg"}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Main content */}
          <div className="card" style={{ flex: 1, margin: 0, minHeight: 400 }}>

            {tab === "perfil" && (
              <form onSubmit={handleSaveProfile}>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Mi Perfil</h3>

                <div className="form-group">
                  <label>Nombre / Organizacion</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="Tu nombre" />
                </div>

                {actor?.type && (
                  <div className="form-group">
                    <label>Tipo de Perfil</label>
                    <input value={({ warehouse: "Almacen / Centro de Acopio", relief: "Centro de Ayuda", transporter: "Transportista" } as any)[actor.type] || actor.type} disabled style={{ opacity: 0.7, cursor: "not-allowed" }} />
                  </div>
                )}

                <div className="form-group">
                  <label>Correo Electronico</label>
                  <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="correo@ejemplo.com" />
                </div>

                <div className="form-group">
                  <label>WhatsApp / Telefono</label>
                  <input value={`${formCountryCode} ${formPhone}`} disabled style={{ opacity: 0.7, cursor: "not-allowed", fontWeight: 600 }} />
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Direccion</label>
                    <input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Calle y numero" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Ciudad</label>
                    <input value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="Ciudad" />
                  </div>
                </div>

                {actor?.type === "transporter" && (
                  <div style={{ display: "flex", gap: 12 }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Tipo de Vehiculo</label>
                      <input value={formVehicleType} onChange={(e) => setFormVehicleType(e.target.value)} placeholder="Camioneta, Camion..." />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Capacidad (kg)</label>
                      <input type="number" value={formCapacityKg} onChange={(e) => setFormCapacityKg(e.target.value)} placeholder="500" />
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 8 }}>
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
              </form>
            )}

            {tab === "preferencias" && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Preferencias</h3>

                <div className="card" style={{ margin: 0, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--border-color)" }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, display: "block" }}>Tema Oscuro</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cambia entre tema claro y oscuro</span>
                  </div>
                  <button
                    onClick={toggleTheme}
                    style={{
                      background: "var(--bg-main)", border: "1px solid var(--border-color)", borderRadius: 10,
                      padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--text-main)",
                    }}
                  >
                    {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                    {theme === "dark" ? "Claro" : "Oscuro"}
                  </button>
                </div>
              </div>
            )}

            {tab === "legal" && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Privacidad y Terminos</h3>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Politica de Privacidad</h4>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
                    <p>En Logistica en Crisis, nos comprometemos a proteger tu privacidad. La informacion que recopilamos (nombre, telefono, ubicacion) se utiliza exclusivamente para coordinar la ayuda humanitaria entre almacenes, centros de ayuda y transportistas.</p>
                    <p>Tus datos de contacto solo seran compartidos con las partes directamente involucradas en un envio (remitente y destinatario) para facilitar la coordinacion logistica.</p>
                    <p>No compartimos, vendemos ni utilizamos tu informacion para fines publicitarios o de marketing. Puedes solicitar la eliminacion completa de tus datos en cualquier momento desde la seccion "Cuenta" de esta pagina.</p>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Terminos y Condiciones</h4>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
                    <p>Al utilizar esta plataforma, aceptas utilizar la informacion y los recursos compartidos unicamente para fines humanitarios y de ayuda en situaciones de crisis o desastre.</p>
                    <p>Los transportistas registrados se comprometen a entregar los insumos en el destino indicado y a reportar cualquier incidente durante la ruta. Los almacenes y centros de ayuda se comprometen a mantener actualizados sus inventarios y solicitudes.</p>
                    <p>El uso de la plataforma para fines distintos a la asistencia humanitaria resultara en la suspension inmediata de la cuenta y la eliminacion de los datos asociados.</p>
                  </div>
                </div>
              </div>
            )}

            {tab === "cuenta" && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Administracion de Cuenta</h3>

                <div className="card" style={{ margin: 0, padding: "16px 20px", marginBottom: 16, border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, display: "block" }}>Cerrar Sesion</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Salir de tu cuenta en este dispositivo</span>
                  </div>
                  <button className="btn btn-secondary" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }} onClick={handleLogout}>
                    <SignOut size={16} /> Cerrar Sesion
                  </button>
                </div>

                <div className="card" style={{ margin: 0, padding: "16px 20px", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", display: "block" }}>Eliminar Cuenta</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                        Esta accion eliminara permanentemente todos tus datos, perfiles e historial. No se puede deshacer.
                      </span>
                    </div>

                    {deleteConfirmStep === 0 && (
                      <button className="btn btn-danger" onClick={() => setDeleteConfirmStep(1)}>
                        <Trash size={16} /> Dar de baja
                      </button>
                    )}

                    {deleteConfirmStep === 1 && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button className="btn btn-secondary" disabled={deleting} onClick={() => setDeleteConfirmStep(0)}>
                          Cancelar
                        </button>
                        <button className="btn btn-danger" disabled={deleting} onClick={() => setDeleteConfirmStep(2)}>
                          <Warning size={16} /> Si, continuar
                        </button>
                      </div>
                    )}

                    {deleteConfirmStep === 2 && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button className="btn btn-secondary" disabled={deleting} onClick={() => setDeleteConfirmStep(0)}>
                          No, mantener cuenta
                        </button>
                        <button className="btn btn-danger" disabled={deleting} onClick={handleDeleteAccount}>
                          {deleting ? "Eliminando..." : "Confirmar y eliminar todo"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .settings-sidebar {
            display: none !important;
          }
        }
        @media (min-width: 769px) {
          .settings-mobile-tabs {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
