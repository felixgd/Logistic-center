"use client";
import { useState, useEffect, useRef } from "react";

interface AutocompleteAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string, city: string, lat: number, lng: number) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
}

export default function AutocompleteAddressInput({
  value,
  onChange,
  onSelect,
  onBlur,
  placeholder = "Ingresa tu dirección...",
  required = false,
}: AutocompleteAddressInputProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = (query: string) => {
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`, {
      headers: {
        "User-Agent": "DisasterAcopioPortal/1.0"
      }
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSuggestions(data);
          setIsOpen(data.length > 0);
        } else {
          setSuggestions([]);
          setIsOpen(false);
        }
      })
      .catch((err) => console.error("Error in geocoding suggestions:", err))
      .finally(() => setLoading(false));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 400);
  };

  const handleSelectOption = (item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    
    const city = item.address.city || item.address.town || item.address.village || item.address.suburb || item.address.county || "";
    const road = item.address.road || "";
    const houseNumber = item.address.house_number || "";
    const neighborhood = item.address.neighbourhood || item.address.suburb || "";
    
    let formattedAddress = road;
    if (houseNumber) {
      formattedAddress += ` #${houseNumber}`;
    } else if (!road && neighborhood) {
      formattedAddress = neighborhood;
    }
    if (!formattedAddress) {
      formattedAddress = item.display_name?.split(",")[0] || item.name || "Dirección seleccionada";
    }

    onSelect(formattedAddress, city, lat, lng);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => {
            setIsOpen(false);
            if (onBlur) onBlur();
          }, 200);
        }}
        placeholder={placeholder}
        required={required}
        style={{ width: "100%" }}
      />
      {loading && (
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-muted)", pointerEvents: "none" }}>
          Buscando...
        </span>
      )}
      {isOpen && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-dark)",
            borderRadius: 8,
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.15)",
            maxHeight: 220,
            overflowY: "auto",
            padding: "4px 0",
          }}
        >
          {suggestions.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectOption(item)}
              style={{
                padding: "8px 12px",
                fontSize: 13,
                color: "var(--text-main)",
                cursor: "pointer",
                borderBottom: idx < suggestions.length - 1 ? "1px solid var(--border-color)" : "none",
                lineHeight: "1.4",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--border-color)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>
                {item.address.road || item.address.neighbourhood || item.address.suburb || item.display_name?.split(",")[0] || item.name}
              </p>
              <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.display_name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
