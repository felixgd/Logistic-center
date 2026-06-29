"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

export default function KycBanner() {
  const [info, setInfo] = useState<{ actorType?: string; diditStatus?: string; kycBlocked?: boolean } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const payload = decodeJwt(token);
    if (!payload) return;
    setInfo({
      actorType: payload.actorType as string,
      diditStatus: payload.diditStatus as string,
      kycBlocked: payload.kycBlocked as boolean,
    });
  }, []);

  const startVerification = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("/api/actores/reverificar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // silent
    }
  }, []);

  if (!info || info.actorType !== "transporter" || info.diditStatus === "approved") {
    return null;
  }

  if (info.kycBlocked) {
    return (
      <div style={{
        background: "#1a1a2e",
        color: "#e0e0e0",
        padding: "10px 16px",
        textAlign: "center",
        fontSize: 14,
        fontWeight: 500,
        borderBottom: "1px solid #e53e3e",
      }}>
        🚫 Tu cuenta ha sido bloqueada por exceder los intentos de verificación. Contacta a soporte.
      </div>
    );
  }

  const isPending = !info.diditStatus || info.diditStatus === "not_started" || info.diditStatus === "pending";

  return (
    <div style={{
      background: isPending ? "#fef3cd" : "#fee2e2",
      color: isPending ? "#856404" : "#b91c1c",
      padding: "10px 16px",
      textAlign: "center",
      fontSize: 14,
      fontWeight: 500,
      borderBottom: isPending ? "1px solid #ffc107" : "1px solid #fca5a5",
    }}>
      {isPending ? (
        <>
          ⏳ Debes completar la verificación de identidad para usar la plataforma.{" "}
          <button onClick={startVerification} style={{ background: "none", border: "none", color: "#004085", textDecoration: "underline", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            Verificar ahora
          </button>
        </>
      ) : (
        <>
          ❌ Tu verificación fue {info.diditStatus?.toLowerCase().replace("_", " ")}.{" "}
          <button onClick={startVerification} style={{ background: "none", border: "none", color: "#7f1d1d", textDecoration: "underline", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            Intentar de nuevo
          </button>
        </>
      )}
    </div>
  );
}
