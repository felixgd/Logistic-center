"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const isValidPhone = (value: string) => normalizePhone(value).length >= 10;

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mocked, setMocked] = useState(false);
  const [mockCode, setMockCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();

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
    if (!isValidPhone(phone)) { setError("Ingresa un teléfono válido"); return; }
    setSending(true); setError("");
    const res = await fetch("/api/verificar/enviar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalizePhone(phone) }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSending(false); return; }
    setSent(true); setSending(false); setCountdown(60);
    if (data.mocked) { setMocked(true); setMockCode(data.code || ""); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!sent) { setError("Solicita un código primero"); return; }
    if (code.length < 6) { setError("Ingresa el código de 6 dígitos"); return; }
    try {
      const res = await fetch("/api/actores/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(phone), code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem("token", data.token);
      localStorage.setItem("actor", JSON.stringify(data.actor));
      router.push("/dashboard");
    } catch { setError("Error al conectar con el servidor"); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ textAlign: "left", marginBottom: 8 }}><Link href="/" className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: 13 }}>← Volver al inicio</Link></div>
        <h2>Iniciar Sesión</h2>
        <p className="subtitle">Sistema de Logística</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Teléfono / WhatsApp</label>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                value={phone}
                onChange={(e) => setPhone(normalizePhone(e.target.value))}
                placeholder="521234567890"
                required
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "4px 12px", fontSize: 12, whiteSpace: "nowrap" }}
                onClick={enviarCodigo}
                disabled={sending || countdown > 0 || !isValidPhone(phone)}
              >
                {sending ? "Enviando..." : countdown > 0 ? `Reenviar (${countdown}s)` : sent ? "Reenviar" : "Enviar código"}
              </button>
            </div>
          </div>
          {sent && (
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
                placeholder="000000"
                maxLength={6}
                required
                style={{ textAlign: "center", letterSpacing: 4, fontSize: 18 }}
              />
            </div>
          )}
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={!sent}>Ingresar</button>
        </form>
        <div className="link">¿No tienes cuenta? <Link href="/register">Regístrate aquí</Link></div>
      </div>
    </div>
  );
}
