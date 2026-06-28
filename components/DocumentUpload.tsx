"use client";
import { useState, useRef } from "react";
import { UploadSimple, FileText, X } from "@phosphor-icons/react";

interface Props {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export default function DocumentUpload({ file, onFileChange }: Props) {
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    validateAndSetFile(f);
  };

  const validateAndSetFile = (f: File) => {
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

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="form-group" style={{ marginBottom: "20px" }}>
      <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "var(--text-main)" }}>
        Documento <small style={{ color: "var(--text-muted)", fontWeight: "normal" }}>(sujeto a verificación)</small> *
      </label>
      
      {/* Hidden Native Input */}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,.webp"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      {/* Styled Interactive Box (Dropzone) */}
      {!file ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragEnter={onDrag}
          onDragOver={onDrag}
          onDragLeave={onDrag}
          onDrop={onDrop}
          style={{
            border: dragActive ? "2px dashed #10b981" : "1px dashed var(--border-dark)",
            borderRadius: "12px",
            background: dragActive ? "rgba(16, 185, 129, 0.02)" : "var(--bg-card)",
            padding: "24px 16px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
          }}
          className="hover-upload-box"
        >
          <UploadSimple size={24} style={{ color: dragActive ? "#10b981" : "var(--text-muted)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-main)" }}>
              Haz clic o arrastra para subir tu documento
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              JPG, PNG, WEBP o PDF hasta 5MB
            </span>
          </div>
        </div>
      ) : (
        /* Styled selected file info card */
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, overflow: "hidden" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", borderRadius: "8px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileText size={20} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {formatSize(file.size)}
              </span>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => {
              onFileChange(null);
              if (inputRef.current) inputRef.current.value = "";
              setError("");
            }}
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "none",
              color: "#ef4444",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s",
              padding: 0,
              flexShrink: 0,
            }}
            title="Eliminar archivo"
          >
            <X size={15} weight="bold" />
          </button>
        </div>
      )}

      {error && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 6, fontWeight: "600" }}>{error}</p>}
    </div>
  );
}
