"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setCsrfToken } from "@/lib/api-client";
import CountryCodeSelect from "@/components/CountryCodeSelect";

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const isValidLocalPhone = (value: string) => normalizePhone(value).length >= 10;

export default function LoginPage() {
  const [localPhone, setLocalPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+52");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mocked, setMocked] = useState(false);
  const [mockCode, setMockCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();

  const fullPhone = () => normalizePhone(countryCode) + normalizePhone(localPhone);

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

  const enviarCodigo = async () => {
    if (!isValidLocalPhone(localPhone)) { setError("Ingresa un teléfono válido (mínimo 10 dígitos sin código de país)"); return false; }
    setSending(true); setError("");
    const res = await fetch("/api/verificar/enviar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: fullPhone() }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSending(false); return false; }
    setSent(true); setSending(false); setCountdown(60); setCode("");
    if (data.mocked) { setMocked(true); setMockCode(data.code || ""); }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isValidLocalPhone(localPhone)) { setError("Ingresa un teléfono válido (mínimo 10 dígitos sin código de país)"); return; }

    if (!sent || code.length < 6) {
      const ok = await enviarCodigo();
      if (ok && !mocked) {
        setError("Te hemos enviado un código de verificación. Ingrésalo para continuar.");
      }
      return;
    }

    try {
      const res = await fetch("/api/actores/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone(), code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem("token", data.token);
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      localStorage.setItem("actor", JSON.stringify(data.actor));
      router.push("/dashboard");
    } catch { setError("Error al conectar con el servidor"); }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    const ok = await enviarCodigo();
    if (ok) setError("Código reenviado.");
  };

  const submitLabel = sending ? "Enviando..." : !sent ? "Solicitar código" : code.length < 6 ? "Solicitar código" : "Ingresar";

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ textAlign: "left", marginBottom: 8 }}><Link href="/" className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: 13 }}>← Volver al inicio</Link></div>
        <h2>Iniciar Sesión</h2>
        <p className="subtitle">Sistema de Logística</p>
        {error && <div className={`alert ${error.includes("enviado") || error.includes("reenviado") ? "" : "alert-error"}`}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Teléfono / WhatsApp</label>
            <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
              <CountryCodeSelect value={countryCode} onChange={setCountryCode} showSearch />
              <input
                value={localPhone}
                onChange={(e) => setLocalPhone(normalizePhone(e.target.value))}
                placeholder="1234567890"
                required
                disabled={sent}
                style={{ flex: 1, borderRadius: "0 6px 6px 0", border: "1px solid #cbd5e1", borderLeft: "none", padding: "10px 12px", fontSize: 14 }}
              />
            </div>
            <small style={{ color: "#6b7280", fontSize: 12 }}>Selecciona tu país e ingresa tu número sin código de país.</small>
          </div>
          <div className="form-group">
            <label>Código de verificación</label>
            {mocked && (
              <div className="alert" style={{ marginBottom: 8, fontSize: 13 }}>
                Modo de prueba activo. Usa el código: <strong>{mockCode}</strong>
              </div>
            )}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={sent ? "000000" : "Solicita un código primero"}
              maxLength={6}
              required={sent}
              disabled={!sent}
              style={{ textAlign: "center", letterSpacing: 4, fontSize: 18 }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={sending}>
            {submitLabel}
          </button>
          {sent && (
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <button
                type="button"
                className="btn btn-link"
                style={{ fontSize: 13, padding: 0 }}
                onClick={handleResend}
                disabled={countdown > 0}
              >
                {countdown > 0 ? `Reenviar código (${countdown}s)` : "¿No recibiste el código? Reenviar"}
              </button>
            </div>
          )}
        </form>
        <div className="link">¿No tienes cuenta? <Link href="/register">Regístrate aquí</Link></div>
      </div>
    </div>
  );
}
