"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => <p style={{ color: "#64748b", fontSize: 12, padding: 12 }}>Cargando mapa...</p>,
});

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    type: "",
    name: "",
    address: "",
    city: "",
    phone: "",
    whatsapp: "",
    email: "",
    password: "",
    vehicleType: "",
    capacityKg: 0,
    lat: null as number | null,
    lng: null as number | null,
  });
  const [error, setError] = useState("");
  const router = useRouter();

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const selectTipo = (tipo: string) => { update("type", tipo); setStep(2); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/actores/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem("token", data.token);
      localStorage.setItem("actor", JSON.stringify(data.actor));
      router.push("/dashboard");
    } catch { setError("Error al registrarse"); }
  };

  const typeLabel: Record<string, string> = { warehouse: "Almacén", relief: "Centro de Ayuda", transporter: "Transportista" };

  return (
    <div className="auth-container">
      <div className="auth-card">
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
            <div className="form-group"><label>Nombre de la organización</label><input value={form.name} onChange={(e) => update("name", e.target.value)} required /></div>
            <div className="form-group"><label>Persona de contacto</label><input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Nombre de contacto" /></div>
            <div className="form-group"><label>Dirección</label><input value={form.address} onChange={(e) => update("address", e.target.value)} required /></div>
            <div className="form-group"><label>Ciudad</label><input value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
            
            <div className="form-group">
              <span className="map-instructions">📍 Ubicación en el mapa (haz clic para marcar):</span>
              <div className="register-map-wrapper" style={{ height: "200px", marginBottom: "16px" }}>
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
