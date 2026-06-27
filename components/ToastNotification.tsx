"use client";
import { useEffect, useState } from "react";

const DURATION = 8000;

interface Props {
  id: string;
  message: string;
  path: string;
  onClose: (id: string) => void;
  onNavigate: (path: string) => void;
}

export default function ToastNotification({ id, message, path, onClose, onNavigate }: Props) {
  const [remaining, setRemaining] = useState(DURATION);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, DURATION - elapsed);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(interval);
        onClose(id);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [id, onClose]);

  const pct = (remaining / DURATION) * 100;

  return (
    <div
      onClick={() => { onNavigate(path); onClose(id); }}
      style={{
        position: "fixed", bottom: 24, left: 24,
        background: "#1e293b", color: "#fff",
        padding: "12px 20px", borderRadius: 8,
        cursor: "pointer", zIndex: 9999,
        minWidth: 280, maxWidth: 400,
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", zIndex: 1, fontSize: 14, lineHeight: 1.4 }}>
        {message}
      </div>
      <div style={{
        position: "absolute", bottom: 0, left: 0, height: 3,
        width: `${pct}%`, background: "#3b82f6",
        transition: "width 0.05s linear",
      }} />
    </div>
  );
}
