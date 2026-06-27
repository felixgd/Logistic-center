"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import ToastNotification from "./ToastNotification";
import { getAuthHeaders } from "@/lib/api-client";

const EVENT_META: Record<string, { msg: (p: any) => string; path: string }> = {
  "insumo.registrado": { msg: (p) => `Nuevo insumo: ${p?.name || ""}`, path: "/insumos" },
  "solicitud.creada": { msg: (p) => `Nueva solicitud: ${p?.name || ""}`, path: "/solicitudes" },
  "viaje.creado": { msg: (p) => "Nuevo viaje creado", path: "/viajes" },
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastNotifier />
    </>
  );
}

function ToastNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const [toasts, setToasts] = useState<{ id: string; message: string; path: string }[]>([]);
  const shownEvents = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const navigateToast = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  useEffect(() => {
    if (!token || pathname === "/" || pathname === "/login" || pathname === "/register") return;

    const headers = getAuthHeaders();

    const poll = () => {
      const since = new Date(Date.now() - 30000).toISOString();
      fetch(`/api/eventos/recientes?since=${encodeURIComponent(since)}`, { headers })
        .then((r) => r.json())
        .then((events: any[]) => {
          for (const ev of events) {
            if (shownEvents.current.has(ev.id)) continue;
            shownEvents.current.add(ev.id);
            const meta = EVENT_META[ev.eventType];
            if (!meta) continue;
            setToasts((prev) => [...prev, { id: ev.id, message: meta.msg(ev.payload), path: meta.path }]);
          }
        })
        .catch(() => {});
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pathname]);

  if (!token || pathname === "/" || pathname === "/login" || pathname === "/register") return null;

  return (
    <>
      {toasts.map((t) => (
        <ToastNotification key={t.id} id={t.id} message={t.message} path={t.path} onClose={closeToast} onNavigate={navigateToast} />
      ))}
    </>
  );
}
