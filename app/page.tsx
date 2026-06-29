"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import dynamic from "next/dynamic";
import AutocompleteAddressInput from "@/components/AutocompleteAddressInput";
import { getAuthHeaders, setCsrfToken, clearCsrfToken } from "@/lib/api-client";
import CountryCodeSelect, { COUNTRY_CODES } from "@/components/CountryCodeSelect";
import DocumentUpload from "@/components/DocumentUpload";
import { 
  Compass, 
  Layout, 
  Package, 
  ClipboardText, 
  Truck, 
  SignIn, 
  SignOut, 
  Plus, 
  Warning, 
  CaretDown,
  List,
  ArrowsClockwise,
  ChatCircle
} from "@phosphor-icons/react";

import { isValidPhoneNumber } from "libphonenumber-js";

const normalizePhone = (value: string) => value.replace(/\D/g, "");

// Validate a full phone number using libphonenumber-js
const isValidPhone = (cc: string, local: string) => {
  const cleanCC = cc.replace(/\D/g, "");
  const cleanLocal = local.replace(/\D/g, "");
  if (cleanLocal.length < 7) return false; // Ensure at least 7 digits as a baseline
  try {
    return isValidPhoneNumber(`+${cleanCC}${cleanLocal}`);
  } catch (e) {
    return false;
  }
};

function splitCountryCode(phone: string): { countryCode: string; local: string } {
  const digits = normalizePhone(phone);
  for (const c of COUNTRY_CODES) {
    const codeDigits = normalizePhone(c.code);
    if (digits.startsWith(codeDigits)) {
      return { countryCode: c.code, local: digits.slice(codeDigits.length) };
    }
  }
  return { countryCode: "+52", local: digits };
}

// Dynamically import the map component with SSR disabled
const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", background: "#f1f5f9" }}>
      <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Cargando mapa interactivo...</p>
    </div>
  ),
});

interface Actor {
  id: string;
  name: string;
  type: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  phone?: string | null;
  whatsapp?: string | null;
}

interface SupplyRequest {
  id: string;
  category: string;
  name: string;
  quantity: number;
  unit: string;
  urgency: string;
  status: string;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    city: string | null;
    lat: number | null;
    lng: number | null;
    whatsapp: string | null;
  };
}

interface Shipment {
  id: string;
  codigoViaje: string;
  almacen: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    whatsapp: string | null;
  };
  centroAyuda: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    whatsapp: string | null;
  };
  transportista: {
    id: string;
    name: string;
    whatsapp: string | null;
  } | null;
  insumos: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  estado: string;
  createdAt: string;
}

export default function HomePage() {
  const [data, setData] = useState<{ actors: Actor[]; recentRequests: SupplyRequest[]; recentShipments: Shipment[] }>({
    actors: [],
    recentRequests: [],
    recentShipments: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"requests" | "shipments">("requests");
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // Mobile bottom-sheet drag states
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth > 768) return;
    if ((e.target as HTMLElement).closest(".btn") || (e.target as HTMLElement).closest(".sidebar-expand-toggle")) return;
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    setDragOffsetY(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    setDragOffsetY(currentY - dragStartY.current);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const travelDistance = window.innerHeight * 0.75 - 182;
    const finalTranslation = sidebarOpen ? dragOffsetY : travelDistance + dragOffsetY;

    if (finalTranslation < travelDistance / 2) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
    setDragOffsetY(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (window.innerWidth > 768) return;
    if ((e.target as HTMLElement).closest(".btn") || (e.target as HTMLElement).closest(".sidebar-expand-toggle")) return;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    setDragOffsetY(0);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setDragOffsetY(moveEvent.clientY - dragStartY.current);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      
      const travelDistance = window.innerHeight * 0.75 - 182;
      const dy = upEvent.clientY - dragStartY.current;
      const finalTranslation = sidebarOpen ? dy : travelDistance + dy;

      if (finalTranslation < travelDistance / 2) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
      setDragOffsetY(0);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Modals state
  const [activeModal, setActiveModal] = useState<"request" | "supply" | "driver" | "claim" | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Common form fields (Pre-filled from localStorage)
  const [formName, setFormName] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formCountryCode, setFormCountryCode] = useState("+52");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formLat, setFormLat] = useState<number | null>(null);
  const [formLng, setFormLng] = useState<number | null>(null);

  // Request & Supply specific fields
  const [formCategory, setFormCategory] = useState("general");
  const [formItemName, setFormItemName] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formUnit, setFormUnit] = useState("unidades");
  const [formUrgency, setFormUrgency] = useState("media");
  const [formNotes, setFormNotes] = useState("");

  // Driver specific fields
  const [formVehicleType, setFormVehicleType] = useState("Camión");
  const [formCapacityKg, setFormCapacityKg] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  // OTP verification state
  const [verifCode, setVerifCode] = useState("");
  const [verifToken, setVerifToken] = useState("");
  const [verifSending, setVerifSending] = useState(false);
  const [verifSent, setVerifSent] = useState(false);
  const [verifMocked, setVerifMocked] = useState(false);
  const [verifMockCode, setVerifMockCode] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Claim Trip specific
  const [activeClaimShipmentId, setActiveClaimShipmentId] = useState<string | null>(null);

  const [availableActors, setAvailableActors] = useState<any[]>([]);
  const [actor, setActor] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) clearInterval(timer);
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/public/map-data");
      const json = await res.json();
      if (res.ok) {
        setData({
          actors: json.actors || [],
          recentRequests: json.recentRequests || [],
          recentShipments: json.recentShipments || [],
        });
      }
    } catch (err) {
      console.error("Error fetching map data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load identified actor from localStorage and start background polling
  useEffect(() => {
    setMounted(true);
    fetchData();

    // Poll the public map API silently every 10 seconds
    const intervalId = setInterval(() => {
      fetch("/api/public/map-data")
        .then((res) => res.json())
        .then((json) => {
          setData({
            actors: json.actors || [],
            recentRequests: json.recentRequests || [],
            recentShipments: json.recentShipments || [],
          });
        })
        .catch((err) => console.error("Error polling map data:", err));
    }, 10000);

    const token = localStorage.getItem("token");
    if (token) {
      setIsAuthenticated(true);
      setVerifToken("authenticated");

      fetch("/api/actores/perfil", {
        headers: getAuthHeaders()
      })
        .then((r) => r.json())
        .then((profile) => {
          if (profile && profile.id) {
            setActor(profile);
            localStorage.setItem("actor", JSON.stringify(profile));
            setFormName(profile.name || "");
            const { countryCode, local } = splitCountryCode(profile.whatsapp || "");
            setFormCountryCode(countryCode);
            setFormWhatsapp(local);
            setFormAddress(profile.address || "");
            setFormCity(profile.city || "");
            if (profile.lat) setFormLat(profile.lat);
            if (profile.lng) setFormLng(profile.lng);
          }
        })
        .catch((e) => console.error("Error fetching profile", e));

      fetch("/api/actores/list", {
        headers: getAuthHeaders()
      })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setAvailableActors(data);
          }
        })
        .catch((e) => console.error("Error fetching available actors", e));
    }

    const storedActor = localStorage.getItem("actor");
    if (storedActor && !token) {
      try {
        const actorObj = JSON.parse(storedActor);
        setActor(actorObj);
        setFormName(actorObj.name || "");
        const { countryCode, local } = splitCountryCode(actorObj.whatsapp || "");
        setFormCountryCode(countryCode);
        setFormWhatsapp(local);
        if (actorObj.address) setFormAddress(actorObj.address);
        if (actorObj.city) setFormCity(actorObj.city);
        if (actorObj.lat) setFormLat(actorObj.lat);
        if (actorObj.lng) setFormLng(actorObj.lng);
      } catch (e) {
        console.error("Error parsing stored actor", e);
      }
    }

    return () => clearInterval(intervalId);
  }, []);

  // Listen for custom popup events to handle selections from Leaflet popups
  useEffect(() => {
    const handleSelectActorEvent = (e: Event) => {
      const actorId = (e as CustomEvent).detail;
      if (actorId) {
        handleCardClick(actorId);
      }
    };
    window.addEventListener("select-actor", handleSelectActorEvent);
    return () => {
      window.removeEventListener("select-actor", handleSelectActorEvent);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("actor");
    clearCsrfToken();
    setIsAuthenticated(false);
    setFormName("");
    setFormWhatsapp("");
    setFormCountryCode("+52");
  };

  const fullFormPhone = () => normalizePhone(formCountryCode) + normalizePhone(formWhatsapp);

  const enviarCodigoVerificacion = async () => {
    if (!formWhatsapp || !isValidPhone(formCountryCode, formWhatsapp)) {
      setSubmitError("Ingresa un número de WhatsApp válido para el código de país seleccionado (mínimo 7 dígitos)");
      return;
    }
    setVerifSending(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/verificar/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullFormPhone() }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error); setVerifSending(false); return; }
      setVerifSent(true);
      setVerifSending(false);
      setCountdown(60);
      if (data.mocked) { setVerifMocked(true); setVerifMockCode(data.code || ""); }
    } catch {
      setSubmitError("Error de red al enviar el código");
      setVerifSending(false);
    }
  };

  const verificarCodigoVerificacion = async () => {
    if (!verifCode || verifCode.length < 6) return;
    setSubmitError("");
    try {
      const res = await fetch("/api/verificar/codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullFormPhone(), code: verifCode }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error); return; }
      setVerifToken(data.token);
      setVerifCode("");
    } catch {
      setSubmitError("Error de red al verificar el código");
    }
  };

  const handleCardClick = (actorId: string) => {
    setSelectedActorId(null);
    setTimeout(() => {
      setSelectedActorId(actorId);
    }, 50);
  };

  // Opens a modal and resets status
  const openModal = (type: "request" | "supply" | "driver") => {
    setSubmitError("");
    setSubmitSuccess("");
    // Keep name and whatsapp prefilled
    setFormItemName("");
    setFormQuantity("");
    setFormNotes("");
    if (!isAuthenticated) {
      setFormLat(null);
      setFormLng(null);
      setFormAddress("");
      setFormCity("");
      
      // Auto-detect location on modal open if available
      if (typeof window !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setFormLat(lat);
            setFormLng(lng);

            // Fetch address and city
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
              headers: {
                "User-Agent": "DisasterAcopioPortal/1.0"
              }
            })
              .then((r) => r.json())
              .then((data) => {
                if (data && data.address) {
                  const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || "";
                  const road = data.address.road || "";
                  const houseNumber = data.address.house_number || "";
                  const neighborhood = data.address.neighbourhood || data.address.suburb || "";
                  let formattedAddress = road;
                  
                  if (houseNumber) {
                    formattedAddress += ` #${houseNumber}`;
                  } else if (!road && neighborhood) {
                    formattedAddress = neighborhood;
                  }
                  
                  if (!formattedAddress) {
                    formattedAddress = data.display_name?.split(",")[0] || "Ubicación actual";
                  }

                  setFormAddress(formattedAddress);
                  setFormCity(city);
                }
              })
              .catch((err) => console.error("Error in reverse geocoding on modal load:", err));
          },
          (err) => console.log("Geolocation permission not granted or failed on modal load:", err)
        );
      }
    }
    setVerifCode("");
    if (!isAuthenticated) setVerifToken("");
    setVerifSent(false);
    setVerifMocked(false);
    setVerifMockCode("");
    setDocumentFile(null);
    setCountdown(0);
    setActiveModal(type);
  };

  const geocodeAddress = async () => {
    if (!formAddress.trim()) return;
    const query = formCity.trim() ? `${formAddress}, ${formCity}` : formAddress;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
        headers: {
          "User-Agent": "DisasterAcopioPortal/1.0"
        }
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        setFormLat(parseFloat(item.lat));
        setFormLng(parseFloat(item.lon));
      }
    } catch (e) {
      console.error("Error geocoding address on blur:", e);
    }
  };

  const openClaimModal = (shipmentId: string) => {
    setSubmitError("");
    setSubmitSuccess("");
    setDocumentFile(null);
    setActiveClaimShipmentId(shipmentId);
    setActiveModal("claim");
  };

  // Submit request / supply / driver
  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formWhatsapp) {
      setSubmitError("Nombre y WhatsApp son obligatorios.");
      return;
    }

    if (!isAuthenticated && !verifToken) {
      setSubmitError("Debes verificar tu WhatsApp antes de publicar.");
      return;
    }

    if (activeModal === "driver" && !isAuthenticated && !documentFile) {
      setSubmitError("Debes subir un documento de identificación (sujeto a verificación).");
      return;
    }

    try {
      setSubmitLoading(true);
      setSubmitError("");

      let documentUrl = "";
      if (activeModal === "driver" && !isAuthenticated && documentFile) {
        const fd = new FormData();
        fd.append("file", documentFile);
        const upRes = await fetch("/api/upload/document", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (!upRes.ok) { setSubmitError(upData.error); setSubmitLoading(false); return; }
        documentUrl = upData.url;
      }

      const payload: any = {
        action: activeModal,
        name: formName,
        whatsapp: fullFormPhone(),
        address: formAddress || "Sin dirección",
        city: formCity || "Sin ciudad",
        lat: formLat,
        lng: formLng,
        category: formCategory,
        itemName: formItemName,
        quantity: Number(formQuantity),
        unit: formUnit,
        urgency: formUrgency,
        notes: formNotes,
        vehicleType: formVehicleType,
        capacityKg: Number(formCapacityKg) || 0,
        ...(activeModal === "driver" && !isAuthenticated && documentUrl ? { documentUrl } : {}),
      };
      if (!isAuthenticated && verifToken) {
        payload.phoneVerificationToken = verifToken;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAuthenticated) {
        const jwt = localStorage.getItem("token");
        if (jwt) headers.Authorization = `Bearer ${jwt}`;
      }

      const res = await fetch("/api/public/submit", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || "Ocurrió un error.");
        return;
      }

      // Save credentials in browser
      localStorage.setItem("token", json.token);
      if (json.csrfToken) setCsrfToken(json.csrfToken);
      localStorage.setItem("actor", JSON.stringify(json.actor));
      setIsAuthenticated(true);
      setActor(json.actor);

      setSubmitSuccess("¡Registro exitoso y publicado con éxito!");
      setTimeout(() => {
        setActiveModal(null);
        fetchData();
      }, 1500);
    } catch (err: any) {
      setSubmitError("Error de red al procesar la solicitud.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Claim proposed trip
  const handleClaimTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formWhatsapp) {
      setSubmitError("Nombre y WhatsApp son obligatorios.");
      return;
    }

    if (!isAuthenticated && !documentFile) {
      setSubmitError("Debes subir un documento de identificación (sujeto a verificación).");
      return;
    }

    try {
      setSubmitLoading(true);
      setSubmitError("");

      let documentUrl = "";
      if (!isAuthenticated && documentFile) {
        const fd = new FormData();
        fd.append("file", documentFile);
        const upRes = await fetch("/api/upload/document", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (!upRes.ok) { setSubmitError(upData.error); setSubmitLoading(false); return; }
        documentUrl = upData.url;
      }

      const res = await fetch("/api/public/claim-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: activeClaimShipmentId,
          name: formName,
          whatsapp: fullFormPhone(),
          ...(!isAuthenticated && documentUrl ? { documentUrl } : {}),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || "Ocurrió un error.");
        return;
      }

      if (json.token) localStorage.setItem("token", json.token);
      if (json.csrfToken) setCsrfToken(json.csrfToken);
      if (json.actor) localStorage.setItem("actor", JSON.stringify(json.actor));
      setSubmitSuccess("¡Viaje asignado con éxito! Revisa tus mensajes de WhatsApp para coordinar.");
      setTimeout(() => {
        setActiveModal(null);
        fetchData();
      }, 2000);
    } catch (err) {
      setSubmitError("Error al reclamar el viaje.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const getUrgencyBadgeColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case "alta":
      case "urgente":
      case "crítica":
      case "critica":
        return "#fee2e2";
      case "media":
        return "#fef3c7";
      default:
        return "#f1f5f9";
    }
  };

  const getUrgencyTextColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case "alta":
      case "urgente":
      case "crítica":
      case "critica":
        return "#991b1b";
      case "media":
        return "#92400e";
      default:
        return "#475569";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case "open":
        return "Abierta";
      case "in_progress":
        return "En Camino";
      case "completed":
        return "Completada";
      default:
        return status;
    }
  };

  // Dynamic bottom sheet drag styles
  const travelDistance = typeof window !== "undefined" ? window.innerHeight * 0.75 - 182 : 0;
  const translation = isDragging
    ? (sidebarOpen 
        ? Math.max(0, Math.min(travelDistance, dragOffsetY))
        : Math.max(0, Math.min(travelDistance, travelDistance + dragOffsetY))
      )
    : null;

  const sidebarStyle: React.CSSProperties = translation !== null
    ? {
        transform: `translateY(${translation}px)`,
        transition: "none",
      }
    : {};

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden" }}>
      {/* Top Header Navigation */}
      <Navbar isAuthenticated={isAuthenticated} actor={actor} />

      <div className="homepage-container">



        {/* Sidebar Section */}
        <aside 
          className={`homepage-sidebar-content ${sidebarOpen ? "open" : ""}`}
          style={sidebarStyle}
        >
          <div 
            className="sidebar-header" 
            style={{ padding: "12px 20px 20px 20px", cursor: "ns-resize" }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onClick={(e) => {
              // On mobile, clicking the header background toggles the expand/collapse of the sheet
              if ((e.target as HTMLElement).closest(".btn") || (e.target as HTMLElement).closest(".sidebar-expand-toggle") || (e.target as HTMLElement).closest(".profile-switcher")) return;
              setSidebarOpen(!sidebarOpen);
            }}
          >
            {/* Visual drag handle pill */}
            <div className="sidebar-drag-handle" style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
              <div style={{ width: "40px", height: "4px", backgroundColor: "rgba(0, 0, 0, 0.1)", borderRadius: "2px" }}></div>
            </div>
            
            <div className="sidebar-header-panel" style={{ padding: 0, borderBottom: "none", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "var(--text-main)" }}>Acciones Rápidas</h3>
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  style={{ 
                    background: "var(--border-color)", 
                    border: "none", 
                    color: "var(--text-main)", 
                    cursor: "pointer", 
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "6px 12px",
                    borderRadius: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "background 0.2s"
                  }}
                  className="sidebar-expand-toggle"
                >
                  {sidebarOpen ? "▼ Minimizar" : "▲ Ver Actividad"}
                </button>
              </div>


            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openModal("request")} className="btn btn-danger" style={{ flex: 1 }}>
                  <Warning size={16} weight="bold" />
                  Pedir Ayuda
                </button>
                <button onClick={() => openModal("supply")} className="btn btn-success" style={{ flex: 1 }}>
                  <Package size={16} weight="bold" />
                  Ofrecer Ayuda
                </button>
              </div>
              <button onClick={() => openModal("driver")} className="btn btn-warning" style={{ width: "100%" }}>
                <Truck size={18} weight="bold" />
                Quiero Transportar
              </button>
            </div>
          </div>

        {/* Navigation Tabs */}
        <div className="tab-nav">
          <button className={`tab-btn ${activeTab === "requests" ? "active" : ""}`} onClick={() => setActiveTab("requests")}>
            Solicitudes ({data.recentRequests.length})
          </button>
          <button className={`tab-btn ${activeTab === "shipments" ? "active" : ""}`} onClick={() => setActiveTab("shipments")}>
            Envíos ({data.recentShipments.length})
          </button>
        </div>

        {/* Content list */}
        <div className="activity-list">
          {loading ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 24, fontSize: 14 }}>Cargando datos recientes...</p>
          ) : activeTab === "requests" ? (
            data.recentRequests.length === 0 ? (
              <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 24, fontSize: 13 }}>No hay solicitudes recientes.</p>
            ) : (
              data.recentRequests.map((req) => (
                <div key={req.id} className={`activity-card ${req.actor.id === selectedActorId ? "active" : ""}`} onClick={() => handleCardClick(req.actor.id)}>
                  <div className="activity-card-header">
                    <span className="activity-card-title">{req.name}</span>
                    <span className="activity-card-time">{new Date(req.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="activity-card-body">
                    <p style={{ marginBottom: 4 }}>
                      Cant: <strong>{req.quantity} {req.unit}</strong>
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Solicita: {req.actor.name} ({req.actor.city || "Sin ciudad"})</p>
                  </div>
                  <div className="activity-card-footer" style={{ marginTop: 12 }}>
                    <span
                      className="badge"
                      style={{
                        background: getUrgencyBadgeColor(req.urgency),
                        color: getUrgencyTextColor(req.urgency),
                        padding: "2px 8px",
                      }}
                    >
                      Prioridad: {req.urgency}
                    </span>
                    {req.actor.whatsapp && (
                      <a
                        href={`https://wa.me/${req.actor.whatsapp.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(req.actor.name)},%20te%20contacto%20desde%20la%20plataforma%20de%20acopio.%20Vi%20tu%20solicitud%20de%20${encodeURIComponent(req.quantity)}%20${encodeURIComponent(req.unit)}%20de%20${encodeURIComponent(req.name)}%20y%20quiero%20coordinar%20ayuda.`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-success"
                        style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ChatCircle size={14} weight="bold" />
                        Enviar ayuda
                      </a>
                    )}
                  </div>
                </div>
              ))
            )
          ) : data.recentShipments.length === 0 ? (
            <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 24, fontSize: 13 }}>No hay envíos/viajes activos.</p>
          ) : (
            data.recentShipments.map((ship) => (
              <div key={ship.id} className={`activity-card ${ship.centroAyuda.id === selectedActorId ? "active" : ""}`} onClick={() => handleCardClick(ship.centroAyuda.id)}>
                <div className="activity-card-header">
                  <span className="activity-card-title">Código: {ship.codigoViaje}</span>
                  <span className="activity-card-time">{new Date(ship.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="activity-card-body">
                  <p style={{ fontSize: 12, marginBottom: 4 }}>
                    <strong>Origen:</strong> {ship.almacen.name}
                  </p>
                  <p style={{ fontSize: 12, marginBottom: 4 }}>
                    <strong>Destino:</strong> {ship.centroAyuda.name}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                    Insumos: {ship.insumos.map((i) => `${i.quantity} ${i.unit} de ${i.name}`).join(", ")}
                  </p>
                </div>
                <div className="activity-card-footer" style={{ marginTop: 10 }}>
                  <span className={`badge ${ship.estado === "approved" ? "badge-pendiente" : ship.estado === "assigned" ? "badge-proceso" : ship.estado === "in_transit" ? "badge-proceso" : "badge-completado"}`} style={{ padding: "2px 8px" }}>
                    {ship.estado === "approved" ? "Por Transportar" : ship.estado === "assigned" ? "Conductor Asignado" : ship.estado === "in_transit" ? "En Tránsito" : ship.estado === "delivered" ? "Entregado" : ship.estado}
                  </span>
                  {ship.estado === "approved" ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openClaimModal(ship.id);
                      }}
                      className="btn btn-warning"
                      style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Truck size={14} weight="bold" />
                      Transportar
                    </button>
                  ) : (
                    ship.transportista?.whatsapp && (
                      <a
                        href={`https://wa.me/${ship.transportista.whatsapp.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(ship.transportista.name)},%20te%20contacto%20sobre%20el%20envío%20${encodeURIComponent(ship.codigoViaje)}.`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ChatCircle size={14} weight="bold" />
                        Contactar
                      </a>
                    )
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Map Section */}
      <main className="map-container-wrapper">
        <MapComponent 
          containerId="main-map" 
          actors={data.actors} 
          selectedActorId={selectedActorId} 
          sidebarOpen={sidebarOpen}
          onMapClick={() => {
            if (sidebarOpen) {
              setSidebarOpen(false);
            }
          }}
        />

        {/* Floating refresh button */}
        <button className="floating-refresh" onClick={fetchData} title="Actualizar datos" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ArrowsClockwise size={16} weight="bold" />
        </button>
      </main>

      {/* Action Modals */}
      {activeModal && activeModal !== "claim" && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px" }}>
            <h3>
              {activeModal === "request" && "Solicitar Insumos (Pedir Ayuda)"}
              {activeModal === "supply" && "Ofrecer Insumos (Ofrecer Ayuda)"}
              {activeModal === "driver" && "Registrarse como Transportista"}
            </h3>

            {submitError && <div className="alert alert-error">{submitError}</div>}
            {submitSuccess && <div className="alert alert-success">{submitSuccess}</div>}

            <form onSubmit={handleSubmitAction}>
              <div className="form-group">
                <label>Tu Nombre / Organización</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="Ej: Refugio Local" />
              </div>
              <div className="form-group">
                <label>Tu WhatsApp</label>
                <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                  <div className="phone-input-container">
                    <CountryCodeSelect value={formCountryCode} onChange={setFormCountryCode} showSearch />
                    <input
                      value={formWhatsapp}
                      onChange={(e) => {
                        setFormWhatsapp(normalizePhone(e.target.value));
                        setVerifToken("");
                        setVerifSent(false);
                        setVerifCode("");
                      }}
                      required
                      placeholder="1234567890"
                    />
                  </div>
                  {isAuthenticated || verifToken ? (
                    <span style={{ color: "#16a34a", display: "flex", alignItems: "center", padding: "0 8px", fontSize: 13, whiteSpace: "nowrap" }}>✓ Verificado</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "4px 12px", fontSize: 12, whiteSpace: "nowrap" }}
                      onClick={enviarCodigoVerificacion}
                      disabled={verifSending || countdown > 0 || !isValidPhone(formCountryCode, formWhatsapp)}
                    >
                      {verifSending ? "Enviando..." : countdown > 0 ? `Reenviar (${countdown}s)` : verifSent ? "Reenviar código" : "Verificar"}
                    </button>
                  )}
                </div>
                  {!isAuthenticated && !verifToken && normalizePhone(formWhatsapp).length > 0 && !isValidPhone(formCountryCode, formWhatsapp) && (
                    <small style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4, display: "block" }}>
                      Ingresa un número de WhatsApp válido para el país seleccionado
                    </small>
                  )}
                </div>

              {!isAuthenticated && verifSent && !verifToken && (
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label>Código de verificación</label>
                  {verifMocked && (
                    <div className="alert" style={{ marginBottom: 8, fontSize: 13 }}>
                      Modo de prueba activo. Usa el código: <strong>{verifMockCode}</strong>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      value={verifCode}
                      onChange={(e) => setVerifCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      style={{ flex: 1, textAlign: "center", letterSpacing: 4, fontSize: 18 }}
                    />
                    <button type="button" className="btn btn-success" style={{ padding: "4px 12px", fontSize: 12 }}
                      onClick={verificarCodigoVerificacion} disabled={verifCode.length < 6}>Confirmar</button>
                  </div>
                </div>
              )}

               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label>Dirección</label>
                  <AutocompleteAddressInput
                    value={formAddress}
                    onChange={(val) => setFormAddress(val)}
                    onSelect={(address, city, lat, lng) => {
                      setFormAddress(address);
                      setFormCity(city);
                      setFormLat(lat);
                      setFormLng(lng);
                    }}
                    onBlur={geocodeAddress}
                    placeholder="Calle 123..."
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Ciudad</label>
                  <input value={formCity} onChange={(e) => setFormCity(e.target.value)} onBlur={geocodeAddress} required placeholder="Bogotá" />
                </div>
              </div>

              {/* Map Coordinates Picker */}
              <div className="form-group">
                <span className="map-instructions">📍 Ubicación (haz clic en el mapa para marcar):</span>
                <div className="register-map-wrapper" style={{ height: "180px", marginBottom: "16px" }}>
                  <MapComponent
                    containerId="modal-map"
                    actors={[]}
                    interactive={true}
                    initialLat={formLat || undefined}
                    initialLng={formLng || undefined}
                    onLocationSelected={(lat, lng) => {
                      setFormLat(lat);
                      setFormLng(lng);
                    }}
                    onAddressFound={(address, city) => {
                      setFormAddress(address);
                      setFormCity(city);
                    }}
                  />
                </div>
              </div>

              {/* Specific fields */}
              {activeModal === "driver" ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label>Tipo de Vehículo</label>
                      <input value={formVehicleType} onChange={(e) => setFormVehicleType(e.target.value)} required placeholder="Camioneta, Camión, etc." />
                    </div>
                    <div className="form-group">
                      <label>Capacidad Máxima (kg)</label>
                      <input type="number" value={formCapacityKg} onChange={(e) => setFormCapacityKg(e.target.value)} required placeholder="500" />
                    </div>
                  </div>
                  {!isAuthenticated && <DocumentUpload file={documentFile} onFileChange={setDocumentFile} />}
                </>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label>Categoría</label>
                      <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                        <option value="general">General</option>
                        <option value="agua">Agua</option>
                        <option value="alimentos">Alimentos</option>
                        <option value="medicinas">Medicinas</option>
                        <option value="ropa">Ropa</option>
                        <option value="herramientas">Herramientas</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Insumo / Item</label>
                      <input value={formItemName} onChange={(e) => setFormItemName(e.target.value)} required placeholder="Ej: Agua en botellas" />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="form-group">
                      <label>Cantidad</label>
                      <input type="number" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} required min="1" placeholder="10" />
                    </div>
                    <div className="form-group">
                      <label>Unidad</label>
                      <select value={formUnit} onChange={(e) => setFormUnit(e.target.value)}>
                        <option value="unidades">Unidades</option>
                        <option value="kg">Kilogramos</option>
                        <option value="litros">Litros</option>
                        <option value="cajas">Cajas</option>
                        <option value="palets">Palets</option>
                      </select>
                    </div>
                  </div>

                  {activeModal === "request" && (
                    <div className="form-group">
                      <label>Urgencia</label>
                      <select value={formUrgency} onChange={(e) => setFormUrgency(e.target.value)}>
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                        <option value="critica">Crítica</option>
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Notas Adicionales</label>
                    <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Detalles de la entrega..." rows={2} />
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitLoading || (!isAuthenticated && !verifToken) || !formName || !formWhatsapp}>
                  {submitLoading ? "Publicando..." : "Publicar Ahora"}
                </button>
              </div>
              {!isAuthenticated && !verifToken && formName && formWhatsapp && (
                <small style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8, display: "block", textAlign: "center" }}>
                  Debes verificar tu WhatsApp antes de publicar
                </small>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Claim Trip Modal */}
      {activeModal === "claim" && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Transportar este envío</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              Ingresa tus datos para aceptar el envío. Te enviaremos los detalles del remitente y destinatario para coordinar por WhatsApp.
            </p>

            {submitError && <div className="alert alert-error">{submitError}</div>}
            {submitSuccess && <div className="alert alert-success">{submitSuccess}</div>}

            <form onSubmit={handleClaimTrip}>
              <div className="form-group">
                <label>Tu Nombre Completo</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="Ej: Carlos Gomez" />
              </div>
              <div className="form-group">
                <label>Tu WhatsApp</label>
                <div className="phone-input-container">
                  <CountryCodeSelect value={formCountryCode} onChange={setFormCountryCode} showSearch />
                  <input
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(normalizePhone(e.target.value))}
                    required
                    placeholder="1234567890"
                  />
                </div>
              </div>

              {!isAuthenticated && <DocumentUpload file={documentFile} onFileChange={setDocumentFile} />}

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitLoading}>
                  {submitLoading ? "Asignando..." : "Aceptar y Coordinar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
