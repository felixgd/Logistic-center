"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { setCsrfToken } from "@/lib/api-client";
import CountryCodeSelect from "@/components/CountryCodeSelect";
import RegisterForm from "./RegisterForm";
import AutocompleteAddressInput from "@/components/AutocompleteAddressInput";
import { isValidPhoneNumber } from "libphonenumber-js";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => <p style={{ color: "var(--text-muted)", fontSize: 12, padding: 12 }}>Cargando mapa...</p>,
});

const normalizePhone = (value: string) => value.replace(/\D/g, "");

// Validate a full phone number using libphonenumber-js
const isValidPhone = (cc: string, local: string) => {
  const cleanCC = cc.replace(/\D/g, "");
  const cleanLocal = local.replace(/\D/g, "");
  if (cleanLocal.length < 7) return false; // Ensure at least 7 digits as a baseline
  try {
    return isValidPhoneNumber(`+${cleanCC}${cleanLocal}`);
  } catch (e) {
    return false;
  }
};

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
  const [documentNumber, setDocumentNumber] = useState("");

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

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setForm((f) => ({ ...f, lat, lng }));

          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: {
              "User-Agent": "DisasterAcopioPortal/1.0"
            }
          })
            .then((r) => r.json())
            .then((data) => {
              if (data && data.address) {
                const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || "";
                const road = data.address.road || "";
                const houseNumber = data.address.house_number || "";
                const neighborhood = data.address.neighbourhood || data.address.suburb || "";
                let formattedAddress = road;
                
                if (houseNumber) {
                  formattedAddress += ` #${houseNumber}`;
                } else if (!road && neighborhood) {
                  formattedAddress = neighborhood;
                }
                
                if (!formattedAddress) {
                  formattedAddress = data.display_name?.split(",")[0] || "Ubicación actual";
                }

                setForm((f) => ({ ...f, address: formattedAddress, city }));
              }
            })
            .catch((err) => console.error("Error in reverse geocoding on registration mount:", err));
        },
        (err) => console.log("Geolocation permission not granted or failed on registration mount:", err)
      );
    }
  }, []);

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const geocodeAddress = async () => {
    if (!form.address.trim()) return;
    const query = form.city.trim() ? `${form.address}, ${form.city}` : form.address;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
        headers: {
          "User-Agent": "DisasterAcopioPortal/1.0"
        }
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        setForm(f => ({ ...f, lat, lng }));
      }
    } catch (e) {
      console.error("Error geocoding address on blur:", e);
    }
  };

  const selectTipo = (tipo: string) => { update("type", tipo); setStep(2); };

  const fullPhone = () => {
    const local = normalizePhone(form.phone);
    return normalizePhone(countryCode) + local;
  };

  const enviarCodigo = async () => {
    if (!isValidPhone(countryCode, form.phone)) { setError("Ingresa un número de teléfono válido para el código de país seleccionado (mínimo 7 dígitos)"); return; }
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
    if (!form.phone || !isValidPhone(countryCode, form.phone)) return "Ingresa un teléfono válido para el código de país seleccionado (mínimo 7 dígitos)";
    if (!form.email.trim()) return "El email es requerido";
    if (!isValidEmail(form.email)) return "Ingresa un email válido";
    if (!form.address.trim()) return "La dirección es requerida";
    if (form.type === "transporter" && !form.vehicleType.trim()) return "El tipo de vehículo es requerido";
    if (form.type === "transporter" && !documentNumber.trim()) return "Debes ingresar tu número de identificación (sujeto a verificación)";
    if (!verifToken) return "Debes verificar tu teléfono antes de registrarte";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    try {
      const res = await fetch("/api/actores/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: fullPhone(), whatsapp: fullPhone(), phoneVerificationToken: verifToken, documentNumber: documentNumber || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      if (data.token) localStorage.setItem("token", data.token);
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      if (data.actor) localStorage.setItem("actor", JSON.stringify(data.actor));

      if (data.verificationUrl) {
        window.location.href = data.verificationUrl;
      } else if (data.token) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
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
                <div className="form-group">
                  <label>Dirección</label>
                  <AutocompleteAddressInput
                    value={form.address}
                    onChange={(val) => update("address", val)}
                    onSelect={(address, city, lat, lng) => {
                      setForm(f => ({ ...f, address, city, lat, lng }));
                    }}
                    onBlur={geocodeAddress}
                    required
                  />
                </div>
                <div className="form-group"><label>Ciudad</label><input value={form.city} onChange={(e) => update("city", e.target.value)} onBlur={geocodeAddress} /></div>
              </div>

              <div className="register-map-field">
                <div className="form-group">
                  <span className="map-instructions">📍 Ubicación en el mapa (haz clic para marcar):</span>
                  <div className="register-map-wrapper" style={{ marginBottom: "16px" }}>
                    <MapComponent
                      containerId="register-map"
                      actors={[]}
                      interactive={true}
                      initialLat={form.lat || undefined}
                      initialLng={form.lng || undefined}
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
                        disabled={verifSending || countdown > 0 || !isValidPhone(countryCode, targetPhone)}
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
                {form.type === "transporter" && (
                  <div className="form-group">
                    <label>Número de identificación <small style={{ color: "var(--text-muted)", fontWeight: "normal" }}>(sujeto a verificación)</small></label>
                    <input
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder="INE, pasaporte, cédula..."
                      required
                    />
                  </div>
                )}
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
