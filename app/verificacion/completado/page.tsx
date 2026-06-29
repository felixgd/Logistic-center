"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function VerificationCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const s = searchParams.get("status");
    const sid = searchParams.get("verificationSessionId");
    setStatus(s);
    setSessionId(sid);

    if (s === "Approved") {
      const refreshToken = async () => {
        const token = localStorage.getItem("token");
        if (!token) return;
        try {
          const res = await fetch("/api/actores/refresh-token", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem("token", data.token);
          }
        } catch {
          // fallback: keep old token, user can still refresh manually
        }
      };
      refreshToken();
    }

    if (!s && !sid) {
      const token = localStorage.getItem("token");
      if (token) {
        router.push("/dashboard");
      }
    }
  }, [searchParams, router]);

  if (!status && !sessionId) {
    return (
      <div className="auth-container">
        <div className="auth-card"><p>Cargando...</p></div>
      </div>
    );
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const statusConfig: Record<string, { title: string; icon: string; color: string; message: string }> = {
    Approved: {
      title: "Verificación exitosa",
      icon: "✅",
      color: "#16a34a",
      message: "Tu identidad ha sido verificada correctamente. Ya puedes operar como transportista en la plataforma.",
    },
    Declined: {
      title: "Verificación rechazada",
      icon: "❌",
      color: "#dc2626",
      message: "No pudimos verificar tu identidad. Puedes intentar nuevamente con un documento diferente.",
    },
    "In Review": {
      title: "Verificación en revisión",
      icon: "⏳",
      color: "#d97706",
      message: "Tu documentación está siendo revisada por nuestro equipo. Te notificaremos cuando esté completa.",
    },
    Expired: {
      title: "Sesión expirada",
      icon: "⏰",
      color: "#6b7280",
      message: "El tiempo para completar la verificación ha expirado. Puedes iniciar una nueva verificación.",
    },
  };

  const config = statusConfig[status || ""] || {
    title: "Verificación",
    icon: "📋",
    color: "var(--text-main)",
    message: "Hemos recibido tu información. Pronto tendrás noticias sobre el estado de tu verificación.",
  };

  const handleRetry = async () => {
    try {
      const res = await fetch("/api/actores/reverificar", {
        method: "POST",
        headers: { "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Error al iniciar nueva verificación");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{config.icon}</div>
        <h2 style={{ color: config.color, marginBottom: 12 }}>{config.title}</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.5 }}>{config.message}</p>

        {(status === "Declined" || status === "Expired") && (
          <button className="btn btn-primary" style={{ width: "100%", marginBottom: 12 }} onClick={handleRetry}>
            Intentar de nuevo
          </button>
        )}

        {token ? (
          <Link href="/dashboard" className="btn btn-primary" style={{ display: "block", textAlign: "center" }}>
            Ir al panel principal
          </Link>
        ) : (
          <Link href="/login" className="btn btn-primary" style={{ display: "block", textAlign: "center" }}>
            Iniciar sesión
          </Link>
        )}
      </div>
    </div>
  );
}

export default function VerificationCompletePage() {
  return (
    <Suspense fallback={<div className="auth-container"><div className="auth-card"><p>Cargando...</p></div></div>}>
      <VerificationCompleteContent />
    </Suspense>
  );
}
