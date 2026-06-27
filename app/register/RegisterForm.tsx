"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function RegisterFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const affiliateCode = searchParams.get("code");

  const [step, setStep] = useState(affiliateCode ? 3 : 1);
  const [affiliateInfo, setAffiliateInfo] = useState<any>(null);
  const [form, setForm] = useState({
    type: "", name: "", address: "", city: "", phone: "", whatsapp: "",
    email: "", password: "", vehicleType: "", capacityKg: 0,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (affiliateCode) {
      fetch(`/api/actores/afiliar/info/${affiliateCode}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) { setError(data.error); return; }
          setAffiliateInfo(data);
          setForm((f) => ({ ...f, address: data.address || "", city: data.city || "" }));
        })
        .catch(() => setError("Código inválido o expirado"));
    }
  }, [affiliateCode]);

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const selectTipo = (tipo: string) => { update("type", tipo); setStep(2); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const endpoint = affiliateCode ? "/api/actores/afiliar/registrar" : "/api/actores/register";
    const body = affiliateCode
      ? { code: affiliateCode, name: form.name, phone: form.phone || form.whatsapp, email: form.email, password: form.password }
      : form;

    try {
      const res = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem("token", data.token);
      localStorage.setItem("actor", JSON.stringify(data.actor));
      router.push("/dashboard");
    } catch { setError("Error al registrarse"); }
  };

  if (affiliateCode && affiliateInfo) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Unirse a {affiliateInfo.actorName}</h2>
          <p className="subtitle">
            {affiliateInfo.actorType === "warehouse" ? "Almacén" : "Centro de Ayuda"}
            {affiliateInfo.city ? ` - ${affiliateInfo.city}` : ""}
          </p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label>Nombre completo</label><input value={form.name} onChange={(e) => update("name", e.target.value)} required /></div>
            <div className="form-group"><label>Teléfono / WhatsApp</label><input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="521234567890" required /></div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required /></div>
            <div className="form-group"><label>Contraseña</label><input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required minLength={6} /></div>
            <div className="form-group" style={{ background: "#f1f5f9", padding: 12, borderRadius: 6, fontSize: 13, color: "#475569" }}>
              <strong>Dirección:</strong> {affiliateInfo.address || "No registrada"}<br />
              <strong>Ciudad:</strong> {affiliateInfo.city || "No registrada"}
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Crear cuenta</button>
            <div className="link"><Link href="/login">¿Ya tienes cuenta? Inicia sesión</Link></div>
          </form>
        </div>
      </div>
    );
  }

  if (affiliateCode && !affiliateInfo && !error) {
    return (
      <div className="auth-container">
        <div className="auth-card"><p>Cargando información...</p></div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
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
            <div className="form-group"><label>Nombre de la organización</label><input value={form.name} onChange={(e) => update("name", e.target.value)} required /></div>
            <div className="form-group"><label>Persona de contacto</label><input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Nombre de contacto" /></div>
            <div className="form-group"><label>Dirección</label><input value={form.address} onChange={(e) => update("address", e.target.value)} required /></div>
            <div className="form-group"><label>Ciudad</label><input value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
            <div className="form-group"><label>WhatsApp</label><input value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="521234567890" required /></div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required /></div>
            <div className="form-group"><label>Contraseña</label><input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required minLength={6} /></div>
            {form.type === "transporter" && (
              <>
                <div className="form-group"><label>Tipo de vehículo</label><input value={form.vehicleType} onChange={(e) => update("vehicleType", e.target.value)} placeholder="Camión, camioneta, etc." /></div>
                <div className="form-group"><label>Capacidad (kg)</label><input type="number" value={form.capacityKg || ""} onChange={(e) => update("capacityKg", Number(e.target.value))} /></div>
              </>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Atrás</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Crear cuenta</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function RegisterForm() {
  return (
    <Suspense fallback={<div className="auth-container"><div className="auth-card"><p>Cargando...</p></div></div>}>
      <RegisterFormInner />
    </Suspense>
  );
}
