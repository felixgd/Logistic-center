"use client";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

export default function TableSearch({
  value,
  onChange,
  placeholder = "Buscar en la tabla...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="table-search">
      <span className="table-search-icon" aria-hidden="true">
        <MagnifyingGlass size={16} weight="bold" />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar en la tabla"
      />
      {value && (
        <button
          type="button"
          className="table-search-clear"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
        >
          <X size={14} weight="bold" />
        </button>
      )}
    </div>
  );
}
