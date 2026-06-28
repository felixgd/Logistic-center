"use client";
import { useState, useRef, useEffect } from "react";

export interface CountryCode {
  code: string;
  flag: string;
  name: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: "+52", flag: "🇲🇽", name: "México" },
  { code: "+1", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "+1", flag: "🇨🇦", name: "Canadá" },
  { code: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "+51", flag: "🇵🇪", name: "Perú" },
  { code: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "+58", flag: "🇻🇪", name: "Venezuela" },
  { code: "+503", flag: "🇸🇻", name: "El Salvador" },
  { code: "+502", flag: "🇬🇹", name: "Guatemala" },
  { code: "+504", flag: "🇭🇳", name: "Honduras" },
  { code: "+505", flag: "🇳🇮", name: "Nicaragua" },
  { code: "+506", flag: "🇨🇷", name: "Costa Rica" },
  { code: "+507", flag: "🇵🇦", name: "Panamá" },
  { code: "+591", flag: "🇧🇴", name: "Bolivia" },
  { code: "+593", flag: "🇪🇨", name: "Ecuador" },
  { code: "+595", flag: "🇵🇾", name: "Paraguay" },
  { code: "+598", flag: "🇺🇾", name: "Uruguay" },
  { code: "+34", flag: "🇪🇸", name: "España" },
  { code: "+55", flag: "🇧🇷", name: "Brasil" },
  { code: "+591", flag: "🇩🇴", name: "República Dominicana" },
];

interface CountryCodeSelectProps {
  value: string;
  onChange: (code: string) => void;
  showSearch?: boolean;
}

export default function CountryCodeSelect({ value, onChange, showSearch = false }: CountryCodeSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = COUNTRY_CODES.find((c) => c.code === value) || COUNTRY_CODES[0];

  const filtered = COUNTRY_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search)
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 8px",
          borderRadius: "6px 0 0 6px",
          border: "1px solid var(--border-color)",
          borderRight: "none",
          backgroundColor: "var(--bg-card)",
          color: "var(--text-main)",
          fontSize: 14,
          minWidth: 90,
          cursor: "pointer",
          height: "100%",
        }}
      >
        <span>{selected.flag}</span>
        <span style={{ fontWeight: 600 }}>{selected.code}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 9999,
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-dark)",
            borderRadius: 8,
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.15)",
            minWidth: 220,
            maxHeight: 280,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {showSearch && (
            <div style={{ padding: 8, borderBottom: "1px solid var(--border-color)" }}>
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar país..."
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-main)",
                  color: "var(--text-main)",
                  fontSize: 13,
                }}
              />
            </div>
          )}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.map((c) => (
              <button
                key={`${c.code}-${c.name}`}
                type="button"
                className="hover-gray-bg"
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                  setSearch("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  backgroundColor: c.code === value ? "var(--border-color)" : "transparent",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 14,
                }}
              >
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <span style={{ fontWeight: 600, minWidth: 42 }}>{c.code}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{c.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
                No se encontraron países
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
