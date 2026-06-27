"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/actores/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Ingresar</button>
        </form>
        <div className="link">¿No tienes cuenta? <Link href="/register">Regístrate aquí</Link></div>
      </div>
    </div>
  );
}
