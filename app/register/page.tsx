"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { setCsrfToken } from "@/lib/api-client";
import CountryCodeSelect from "@/components/CountryCodeSelect";
import DocumentUpload from "@/components/DocumentUpload";
import RegisterForm from "./RegisterForm";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => <p style={{ color: "var(--text-muted)", fontSize: 12, padding: 12 }}>Cargando mapa...</p>,
});

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const isValidLocalPhone = (value: string) => normalizePhone(value).length >= 10;

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const affiliateCode = searchParams.get("code");

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    type: "",
    name: "",
    contactName: "",
    address: "",
    city: "",
    phone: "",
    whatsapp: "",
    email: "",
    vehicleType: "",
    capacityKg: 0,
    lat: null as number | null,
    lng: null as number | null,
  });
  const [countryCode, setCountryCode] = useState("+52");
  const [error, setError] = useState("");
  const [verifCode, setVerifCode] = useState("");
  const [verifToken, setVerifToken] = useState("");
  const [verifSending, setVerifSending] = useState(false);
  const [verifSent, setVerifSent] = useState(false);
  const [verifMocked, setVerifMocked] = useState(false);
  const [verifMockCode, setVerifMockCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) clearInterval(timer);
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const selectTipo = (tipo: string) => { update("type", tipo); setStep(2); };

  const fullPhone = () => {
    const local = normalizePhone(form.phone);
    return normalizePhone(countryCode) + local;
  };

  const enviarCodigo = async () => {
    if (!isValidLocalPhone(form.phone)) { setError("Ingresa un número de teléfono válido (mínimo 10 dígitos sin código de país)"); return; }
    setVerifSending(true); setError("");
    const res = await fetch("/api/verificar/enviar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: fullPhone() }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setVerifSending(false); return; }
    setVerifSent(true); setVerifSending(false); setCountdown(60);
    if (data.mocked) { setVerifMocked(true); setVerifMockCode(data.code || ""); }
  };

  const verificarCodigo = async () => {
    if (!verifCode || verifCode.length < 6) return;
    setError("");
    const res = await fetch("/api/verificar/codigo", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: fullPhone(), code: verifCode }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setVerifToken(data.token);
    setVerifCode("");
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateForm = (): string | null => {
    if (!form.type) return "Selecciona un tipo de actor";
    if (!form.name.trim()) return "El nombre de la organización es requerido";
    if (!form.phone || !isValidLocalPhone(form.phone)) return "Ingresa un teléfono válido (mínimo 10 dígitos sin código de país)";
    if (!form.email.trim()) return "El email es requerido";
    if (!isValidEmail(form.email)) return "Ingresa un email válido";
    if (!form.address.trim()) return "La dirección es requerida";
    if (form.type === "transporter" && !form.vehicleType.trim()) return "El tipo de vehículo es requerido";
    if (!documentFile) return "Debes subir un documento de identificación (sujeto a verificación)";
    if (!verifToken) return "Debes verificar tu teléfono antes de registrarte";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    let documentUrl = "";
    if (documentFile) {
      try {
        const fd = new FormData();
        fd.append("file", documentFile);
        const upRes = await fetch("/api/upload/document", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (!upRes.ok) { setError(upData.error); return; }
        documentUrl = upData.url;
      } catch { setError("Error al subir el documento"); return; }
    }

    try {
      const res = await fetch("/api/actores/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: fullPhone(), whatsapp: fullPhone(), phoneVerificationToken: verifToken, documentUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem("token", data.token);
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      localStorage.setItem("actor", JSON.stringify(data.actor));
      router.push("/dashboard");
    } catch { setError("Error al registrarse"); }
  };

  const typeLabel: Record<string, string> = { warehouse: "Almacén", relief: "Centro de Ayuda", transporter: "Transportista" };

  const targetPhone = form.phone;

  if (affiliateCode) {
    return <RegisterForm />;
  }

  return (
    <div className="auth-container">
      <div className={`auth-card ${step === 2 ? "register-step-2" : ""}`}>
        <div style={{ textAlign: "left", marginBottom: 8 }}><Link href="/" className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: 13 }}>← Volver al inicio</Link></div>
        <h2>Registro</h2>
        <p className="subtitle">Crea tu cuenta en el sistema</p>
        {error && <div className="alert alert-error">{error}</div>}
        {step === 1 && (
          <>
            <p style={{ marginBottom: 16, fontWeight: 600 }}>¿Qué tipo de actor eres?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button className="btn btn-primary" onClick={() => selectTipo("warehouse")}>Almacén</button>
              <button className="btn btn-success" onClick={() => selectTipo("relief")}>Centro de Ayuda</button>
              <button className="btn btn-warning" onClick={() => selectTipo("transporter")}>Transportista</button>
            </div>
            <div className="link"><Link href="/login">¿Ya tienes cuenta? Inicia sesión</Link></div>
          </>
        )}
        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div className="register-form-grid">
              
              <div className="register-left-fields">
                <div className="form-group"><label>Nombre de la organización</label><input value={form.name} onChange={(e) => update("name", e.target.value)} required /></div>
                <div className="form-group"><label>Persona de contacto</label><input value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Nombre de contacto" /></div>
                <div className="form-group"><label>Dirección</label><input value={form.address} onChange={(e) => update("address", e.target.value)} required /></div>
                <div className="form-group"><label>Ciudad</label><input value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
              </div>

              <div className="register-map-field">
                <div className="form-group">
                  <span className="map-instructions">📍 Ubicación en el mapa (haz clic para marcar):</span>
                  <div className="register-map-wrapper" style={{ marginBottom: "16px" }}>
                    <MapComponent
                      containerId="register-map"
                      actors={[]}
                      interactive={true}
                      onLocationSelected={(lat, lng) => {
                        update("lat", lat);
                        update("lng", lng);
                      }}
                      onAddressFound={(address, city) => {
                        update("address", address);
                        update("city", city);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="register-bottom-fields">
                <div className="form-group">
                  <label>Teléfono / WhatsApp *</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                    <div className="phone-input-container">
                      <CountryCodeSelect value={countryCode} onChange={setCountryCode} showSearch />
                      <input
                        value={form.phone}
                        onChange={(e) => update("phone", normalizePhone(e.target.value))}
                        placeholder="1234567890"
                        required
                      />
                    </div>
                    {verifToken ? (
                      <span style={{ color: "#16a34a", display: "flex", alignItems: "center", padding: "0 8px", fontSize: 13 }}>✓ Verificado</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: "4px 12px", fontSize: 12, whiteSpace: "nowrap" }}
                        onClick={enviarCodigo}
                        disabled={verifSending || countdown > 0 || !isValidLocalPhone(targetPhone)}
                      >
                        {verifSending ? "Enviando..." : countdown > 0 ? `Reenviar (${countdown}s)` : verifSent ? "Reenviar código" : "Verificar"}
                      </button>
                    )}
                  </div>
                  <small style={{ color: "var(--text-muted)", fontSize: 12 }}>Selecciona tu país e ingresa tu número sin código de país. Te enviaremos un código de verificación.</small>
                </div>
                {verifSent && !verifToken && (
                  <div className="form-group">
                    <label>Código de verificación</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input
                        value={verifCode}
                        onChange={(e) => setVerifCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        style={{ flex: 1, textAlign: "center", letterSpacing: 4, fontSize: 18 }}
                      />
                      <button type="button" className="btn btn-success" style={{ padding: "4px 12px", fontSize: 12 }}
                        onClick={verificarCodigo} disabled={verifCode.length < 6}>Confirmar</button>
                    </div>
                  </div>
                )}
                <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required /></div>
                {form.type === "transporter" && (
                  <>
                    <div className="form-group"><label>Tipo de vehículo</label><input value={form.vehicleType} onChange={(e) => update("vehicleType", e.target.value)} placeholder="Camión, camioneta, etc." /></div>
                    <div className="form-group"><label>Capacidad (kg)</label><input type="number" value={form.capacityKg || ""} onChange={(e) => update("capacityKg", Number(e.target.value))} /></div>
                  </>
                )}
                <DocumentUpload file={documentFile} onFileChange={setDocumentFile} />
              </div>

              <div className="register-buttons-field">
                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Atrás</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!verifToken}>Crear cuenta</button>
              </div>

            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="auth-container"><div className="auth-card"><p>Cargando...</p></div></div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
