"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders } from "@/lib/api-client";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/notificaciones", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string, link?: string | null) => {
    if (!token) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await fetch(`/api/notificaciones/${id}/leida`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
    if (link) {
      setOpen(false);
      router.push(link);
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  if (!token) return null;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) fetchNotifications();
        }}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          position: "relative",
          padding: 8,
          color: "#fff",
          fontSize: 20,
        }}
        aria-label="Notificaciones"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              background: "#ef4444",
              color: "#fff",
              borderRadius: "50%",
              minWidth: 18,
              height: 18,
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 360,
            maxHeight: 480,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            border: "1px solid #e2e8f0",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong style={{ color: "#0f172a", fontSize: 15 }}>Notificaciones</strong>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", flex: 1, maxHeight: 400 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 14 }}>
                No tienes notificaciones
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id, n.link)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f8fafc",
                    cursor: n.link ? "pointer" : "default",
                    background: n.read ? "#fff" : "#eff6ff",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <strong style={{ color: "#0f172a", fontSize: 13, fontWeight: 700 }}>{n.title}</strong>
                    <span style={{ color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap" }}>{formatDate(n.createdAt)}</span>
                  </div>
                  <p style={{ color: "#475569", fontSize: 13, margin: "4px 0 0", lineHeight: 1.4 }}>{n.message}</p>
                  {!n.read && (
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb" }} />
                      <span style={{ color: "#2563eb", fontSize: 11, fontWeight: 600 }}>Sin leer</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
