"use client";
import { useState, useRef } from "react";

interface Props {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export default function DocumentUpload({ file, onFileChange }: Props) {
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    const allowed = ["jpg", "jpeg", "png", "pdf", "webp"];
    if (!allowed.includes(ext)) {
      setError("Formato no permitido. Usa JPG, PNG o PDF.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("El archivo no debe superar 5 MB.");
      return;
    }

    setError("");
    onFileChange(f);
  };

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
        style={{ display: file ? "none" : "block", width: "100%" }}
      />
      {error && <p style={{ fontSize: 13, color: "#dc2626", marginTop: 4 }}>{error}</p>}
      {file && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 13 }}>📎 {file.name}</span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "2px 8px", fontSize: 11 }}
            onClick={() => {
              onFileChange(null);
              if (inputRef.current) inputRef.current.value = "";
              setError("");
            }}
          >
            Cambiar
          </button>
        </div>
      )}
    </div>
  );
}
