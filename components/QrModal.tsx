"use client";
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface Props {
  url: string;
  actorName: string;
  code: string;
  onClose: () => void;
}

export default function QrModal({ url, actorName, code, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 220, margin: 2 }, (err) => {
        if (err) console.error("Error generando QR:", err);
      });
    }
  }, [url]);

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    alert("Enlace copiado al portapapeles");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", maxWidth: 380 }}>
        <h3>Código de Afiliación</h3>
        <p style={{ color: "var(--text-muted)", marginBottom: 16, fontSize: 14 }}>
          Comparte este código QR para que otros miembros puedan unirse a <strong>{actorName}</strong>
        </p>
        <canvas ref={canvasRef} style={{ margin: "0 auto 16px", borderRadius: 8 }} />
        <div style={{ background: "var(--border-color)", color: "var(--text-muted)", padding: "8px 16px", borderRadius: 6, marginBottom: 16, fontFamily: "monospace", fontSize: 18, letterSpacing: 2 }}>
          {code}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn btn-secondary" onClick={copyLink}>Copiar Enlace</button>
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
