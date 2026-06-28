"use client";
import { useState, useRef } from "react";

interface Props {
  value: string;
  onChange: (url: string) => void;
}

export default function DocumentUpload({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const allowed = ["jpg", "jpeg", "png", "pdf", "webp"];
    if (!allowed.includes(ext)) {
      setError("Formato no permitido. Usa JPG, PNG o PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo no debe superar 5 MB.");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/document", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al subir");
        return;
      }

      onChange(data.url);
    } catch {
      setError("Error de red al subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const fileName = value ? value.split("/").pop() || "Documento" : "";

  return (
    <div className="form-group">
      <label>
        Documento <small style={{ color: "var(--text-muted)" }}>(sujeto a verificación)</small> *
      </label>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,.webp"
        onChange={handleFile}
        style={{ display: value ? "none" : "block", width: "100%" }}
        disabled={uploading}
      />
      {uploading && <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Subiendo...</p>}
      {error && <p style={{ fontSize: 13, color: "#dc2626", marginTop: 4 }}>{error}</p>}
      {value && !uploading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 13, color: "#16a34a" }}>✓ Subido: {fileName}</span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "2px 8px", fontSize: 11 }}
            onClick={() => {
              onChange("");
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Cambiar
          </button>
        </div>
      )}
    </div>
  );
}
