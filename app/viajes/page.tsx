"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import TableSearch from "@/components/TableSearch";
import { useSort } from "@/hooks/useSort";
import { useSearch } from "@/hooks/useSearch";
import { useApi, invalidateCache } from "@/lib/swr";
import { getAuthHeaders } from "@/lib/api-client";
import { 
  Truck, 
  MapPin, 
  Clock, 
  CheckCircle, 
  Warning, 
  NavigationArrow, 
  ClipboardText, 
  SlidersHorizontal, 
  Download, 
  CaretRight, 
  CaretLeft, 
  Circle,
  X,
  Check,
  MapTrifold,
  Package
} from "@phosphor-icons/react";

// Static Leaflet CSS imports
import "leaflet/dist/leaflet.css";

const PIN_SVGs = {
  warehouse: `<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M218.83,103.77l-80-75.06a16,16,0,0,0-21.66,0l-80,75.06A16,16,0,0,0,32,115.55V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V115.55A16,16,0,0,0,218.83,103.77ZM144,208H112V160h32Z"></path></svg>`,
  relief: `<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M240,94c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,220.66,16,164,16,94A62,62,0,0,1,122,51.81,62,62,0,0,1,228,94,61.79,61.79,0,0,1,240,94Z"></path></svg>`
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function resolveCoordinates(trip: any, userLocation?: { lat: number; lng: number } | null) {
  let latOri = trip?.almacen?.lat;
  let lngOri = trip?.almacen?.lng;
  let latDes = trip?.centroAyuda?.lat;
  let lngDes = trip?.centroAyuda?.lng;

  const hasOri = typeof latOri === "number" && !isNaN(latOri);
  const hasDes = typeof latDes === "number" && !isNaN(latDes);

  if (!hasOri && !hasDes) {
    // Both missing -> Use user location if available, otherwise La Guaira, Venezuela
    if (userLocation) {
      latOri = userLocation.lat;
      lngOri = userLocation.lng;
      latDes = userLocation.lat + 0.009;
      lngDes = userLocation.lng - 0.007;
    } else {
      latOri = 10.5925;
      lngOri = -66.9317;
      latDes = 10.6015;
      lngDes = -66.9247;
    }
  } else if (hasOri && !hasDes) {
    // Destination missing -> make it close to Origin (offset by ~1.2 km)
    latDes = latOri + 0.009;
    lngDes = lngOri - 0.007;
  } else if (!hasOri && hasDes) {
    // Origin missing -> make it close to Destination
    latOri = latDes - 0.009;
    lngOri = lngDes + 0.007;
  }

  return { latOri, lngOri, latDes, lngDes };
}

export default function TripsPage() {
  const router = useRouter();
  const [actor, setActor] = useState<any>({});
  const [trips, setTrips] = useState<any[]>([]);
  const [disponibles, setDisponibles] = useState<any[]>([]);
  const [error, setError] = useState("");
  
  // States for search and interaction
  const [searchTrips, setSearchTrips] = useState("");
  const [searchDisponibles, setSearchDisponibles] = useState("");
  const [agendaFilter, setAgendaFilter] = useState<"todos" | "en-transito">("todos");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  
  // Mobile Tab Navigation State
  const [mobileTab, setMobileTab] = useState<"activo" | "agenda" | "disponibles" | "historial">("activo");

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          console.log("Geolocation permission denied, using La Guaira fallback.");
        }
      );
    }
  }, []);

  // Modals state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState("retraso");
  const [reportDesc, setReportDesc] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Pagination for shipment history
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 5;

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = getAuthHeaders();

  const { data: tripsData } = useApi<any[]>(token ? "/api/viajes" : null);
  const { data: disponiblesData } = useApi<any[]>(token ? "/api/viajes/disponibles" : null);

  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (tripsData) setTrips(tripsData);
  }, [tripsData]);

  useEffect(() => {
    if (disponiblesData) setDisponibles(disponiblesData);
  }, [disponiblesData]);

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    setActor(JSON.parse(localStorage.getItem("actor") || "{}"));
  }, [token, router]);

  // Helper for showing inline notifications
  const showNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const assignTrip = async (id: string) => {
    setError("");
    try {
      const res = await fetch(`/api/viajes/${id}/asignar`, { method: "POST", headers, body: JSON.stringify({}) });
      if (!res.ok) {
        const d = await res.json();
        showNotification(d.error || "No se pudo asignar el viaje.", "error");
        return;
      }
      showNotification("¡Viaje asignado exitosamente!", "success");
      
      // Auto-switch mobile tab to "agenda" to view newly assigned trip
      setMobileTab("agenda");

      invalidateCache("/api/viajes");
      invalidateCache("/api/viajes/disponibles");
    } catch (e: any) {
      showNotification("Error de red al asignar el viaje.", "error");
    }
  };

  const updateStatus = async (id: string, estado: string) => {
    try {
      const res = await fetch(`/api/viajes/${id}/estado`, { method: "PATCH", headers, body: JSON.stringify({ status: estado }) });
      if (!res.ok) {
        showNotification("Error al actualizar el estado.", "error");
        return;
      }
      showNotification(`Viaje actualizado a: ${STATUS_LABELS[estado]}`, "success");
      
      // Reset checklists if state goes to completed/delivered or cancelled
      if (estado === "delivered" || estado === "cancelled") {
        setSelectedTripId(null);
        setMobileTab("historial"); // Redirect to history tab on mobile
      } else if (estado === "in_transit") {
        setMobileTab("activo"); // Switch to active trip view when transit starts
      }
      
      invalidateCache("/api/viajes");
      invalidateCache("/api/viajes/disponibles");
    } catch (e) {
      showNotification("Error de red al actualizar estado.", "error");
    }
  };

  const STATUS_LABELS: Record<string, string> = {
    proposed: "Propuesto",
    approved: "Aprobado",
    assigned: "Asignado",
    in_transit: "En tránsito",
    delivered: "Completado",
    cancelled: "Cancelado",
  };

  const statusBadge = (s: string) => {
    const classMap: Record<string, string> = {
      proposed: "v-badge-pendiente",
      approved: "v-badge-pendiente",
      assigned: "v-badge-proceso",
      in_transit: "v-badge-transito",
      delivered: "v-badge-completado",
      cancelled: "v-badge-cancelado",
    };
    return `v-badge ${classMap[s] || ""}`;
  };

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("es-MX", { 
      day: "2-digit", 
      month: "2-digit", 
      hour: "2-digit", 
      minute: "2-digit", 
      hour12: true 
    });
  };

  const insumosText = (t: any) =>
    (t.insumos || []).map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(", ");

  // Map trips data to search/sort friendly format
  const tripsMapped = trips.map((t: any) => ({
    ...t,
    _almacen: t.almacen?.name || "",
    _centro: t.centroAyuda?.name || "",
    _transportista: t.transportista?.name || "",
    _insumosText: insumosText(t),
  }));

  // Divide trips into different dashboard lists
  const activeTrip = tripsMapped.find(t => t.id === selectedTripId) || 
                     tripsMapped.find(t => t.estado === "in_transit") || 
                     tripsMapped.find(t => t.estado === "assigned") || 
                     (actor?.type !== "transporter" ? (tripsMapped.find(t => t.estado === "proposed") || tripsMapped.find(t => t.estado === "approved")) : null) ||
                     tripsMapped[0];

  // Agenda upcoming is for currently assigned shipments
  const agendaTrips = tripsMapped.filter((t: any) => {
    if (actor?.type === "transporter") {
      if (agendaFilter === "en-transito") {
        return t.estado === "in_transit";
      }
      return t.estado === "assigned" || t.estado === "in_transit";
    } else {
      if (agendaFilter === "en-transito") {
        return t.estado === "in_transit";
      }
      return t.estado === "proposed" || t.estado === "approved" || t.estado === "assigned" || t.estado === "in_transit";
    }
  });

  // History includes delivered and cancelled trips
  const historyTrips = tripsMapped.filter((t: any) => 
    t.estado === "delivered" || t.estado === "cancelled"
  );

  // Search filter for history
  const filteredHistory = useSearch(historyTrips, searchTrips, [
    "codigoViaje", "_almacen", "_centro", "_insumosText", "estado"
  ]);
  const { sortedData: sortedHistory, SortHeader: SortHeaderHistory } = useSort(filteredHistory, "updatedAt");

  // Paginated History data
  const totalHistoryCount = sortedHistory.length;
  const totalPages = Math.ceil(totalHistoryCount / itemsPerPage) || 1;
  const paginatedHistory = sortedHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);

  // Available shipments filter
  const disponiblesMapped = disponibles.map((t: any) => ({
    ...t,
    _origen: t.almacen?.name || "",
    _destino: t.centroAyuda?.name || "",
    _insumosText: insumosText(t),
  }));
  const filteredDisponibles = useSearch(disponiblesMapped, searchDisponibles, [
    "codigoViaje", "_origen", "_destino", "_insumosText",
  ]);
  const { sortedData: sortedDisponibles } = useSort(filteredDisponibles, "createdAt");

  // Leaflet Dynamic Integration inside Card
  useEffect(() => {
    if (typeof window === "undefined" || !activeTrip) return;

    const container = document.getElementById("active-trip-map");
    if (!container) return;

    // Remove existing map instance safely
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Safely load Leaflet
    import("leaflet").then((L) => {
      const { latOri, lngOri, latDes, lngDes } = resolveCoordinates(activeTrip, userLocation);

      const map = L.map("active-trip-map", {
        center: [latOri, lngOri],
        zoom: 13,
        zoomControl: false,
      });
      mapRef.current = map;

      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

      L.tileLayer(tileUrl, {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      const posOri: L.LatLngTuple = [latOri, lngOri];
      const posDes: L.LatLngTuple = [latDes, lngDes];

      // Custom div icons matching project standard
      const iconOri = L.divIcon({
        html: `<div class="marker-pin warehouse-pin"><span class="icon-inner" style="display:flex;align-items:center;justify-content:center;color:#4b5563;width:100%;height:100%;">${PIN_SVGs.warehouse}</span></div>`,
        className: "custom-div-icon",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      L.marker(posOri, { icon: iconOri }).addTo(map).bindPopup(`<strong>Origen:</strong> ${activeTrip.almacen?.name || 'Origen'}`);

      const iconDes = L.divIcon({
        html: `<div class="marker-pin relief-pin"><span class="icon-inner" style="display:flex;align-items:center;justify-content:center;color:#ef4444;width:100%;height:100%;">${PIN_SVGs.relief}</span></div>`,
        className: "custom-div-icon",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      L.marker(posDes, { icon: iconDes }).addTo(map).bindPopup(`<strong>Destino:</strong> ${activeTrip.centroAyuda?.name || 'Destino'}`);

      // Path dashed polyline
      L.polyline([posOri, posDes], {
        color: "#10B981",
        weight: 3,
        dashArray: "6, 10",
      }).addTo(map);

      // Draw driver's current position with a beautiful green circle with opacity (no pins!)
      if (userLocation) {
        const userPos: L.LatLngTuple = [userLocation.lat, userLocation.lng];
        
        L.circle(userPos, {
          radius: 150,
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(map);

        const driverIcon = L.divIcon({
          html: `<div style="background:#10b981;width:10px;height:10px;border:2px solid #ffffff;border-radius:50%;box-shadow:0 0 8px rgba(16,185,129,0.65);"></div>`,
          className: "custom-user-gps-dot",
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        L.marker(userPos, { icon: driverIcon }).addTo(map).bindPopup("<strong>Tu Ubicación Actual (Conductor)</strong>");
      }

      map.fitBounds([posOri, posDes], { padding: [40, 40] });
    }).catch(err => console.error("Error loading Leaflet: ", err));

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [activeTrip]);


  // CSV Export helper for history
  const handleExportToCSV = () => {
    if (historyTrips.length === 0) {
      showNotification("No hay registros en el historial para exportar.", "info");
      return;
    }
    const headers = ["CÓDIGO", "ALMACÉN/ORIGEN", "CENTRO/DESTINO", "INSUMOS", "ESTADO", "FECHA CR.", "FECHA ACT."];
    const rows = historyTrips.map(t => [
      t.codigoViaje,
      t.almacen?.name || "N/A",
      t.centroAyuda?.name || "N/A",
      (t.insumos || []).map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(" - "),
      STATUS_LABELS[t.estado] || t.estado,
      new Date(t.createdAt).toLocaleString("es-MX"),
      new Date(t.updatedAt).toLocaleString("es-MX")
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Historial_Viajes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("Historial de envíos exportado a CSV.", "success");
  };

  const handleSendReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDesc.trim()) {
      showNotification("Por favor ingresa una descripción.", "error");
      return;
    }
    // Simulate sending report
    showNotification(`Incidente de tipo "${reportType.toUpperCase()}" reportado con éxito al Centro de Soporte.`, "success");
    setIsReportModalOpen(false);
    setReportDesc("");
  };

  // Helper values for simulated travel map overlay
  const getMockDistance = () => {
    if (!activeTrip) return "1.2 KM";
    const { latOri, lngOri, latDes, lngDes } = resolveCoordinates(activeTrip, userLocation);
    const dist = calculateDistance(latOri, lngOri, latDes, lngDes);
    return `${dist.toFixed(1)} KM`;
  };

  const getMockReward = (t: any) => {
    // Deterministic mock price based on ID
    const seed = (t.id || "xyz").charCodeAt(1) || 5;
    const value = 250 + (seed % 10) * 45;
    return `Q${value.toFixed(2)}`;
  };

  const getMockWeight = (t: any) => {
    const seed = (t.id || "xyz").charCodeAt(0) || 120;
    const weight = 80 + (seed % 12) * 35;
    return `${weight}kg`;
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <Navbar />
      
      {/* Dynamic Style tags for advanced responsive styles & transitions */}
      <style>{`
        .v-dash-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 24px;
          margin-top: 24px;
        }

        .grid-left-main { grid-column: span 8; }
        .grid-right-side { grid-column: span 4; }
        .grid-left-small { grid-column: span 4; }
        .grid-right-main { grid-column: span 8; }

        @media (max-width: 768px) {
          .v-dash-grid { 
            gap: 0; 
            margin-top: 12px;
            display: block;
          }
          
          /* Hide all sections by default on mobile */
          .grid-left-main, .grid-right-side, .grid-left-small, .grid-right-main {
            display: none !important;
          }

           /* Display only the active mobile tab */
          .mobile-tab-activo .grid-left-main {
            display: block !important;
          }
          .mobile-tab-agenda .grid-right-side {
            display: block !important;
          }
          .mobile-tab-disponibles .grid-left-small {
            display: block !important;
          }
          .mobile-tab-historial .grid-right-main {
            display: block !important;
          }
        }

        /* Bottom Nav Bar - Mobile only */
        .v-bottom-nav {
          display: none;
        }

        @media (max-width: 768px) {
          .v-bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 64px;
            background: var(--bg-card);
            border-top: 1px solid var(--border-color);
            box-shadow: 0 -4px 12px rgba(0,0,0,0.15);
            z-index: 5000;
            justify-content: space-around;
            align-items: center;
            padding-bottom: env(safe-area-inset-bottom);
          }
          body {
            padding-bottom: 84px !important;
          }
        }

        .v-bottom-nav-item {
          background: none;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          gap: 4px;
          flex: 1;
          height: 100%;
          transition: all 0.25s;
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }

        .v-bottom-nav-item.active {
          color: #10b981;
        }

        /* Toast Styling */
        .v-toast {
          position: fixed;
          bottom: 80px; /* offset bottom nav on mobile */
          right: 24px;
          z-index: 10000;
          padding: 16px 24px;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          gap: 10px;
          animation: slideUp 0.3s ease;
        }
        @media (min-width: 769px) {
          .v-toast {
            bottom: 24px;
          }
        }
        .v-toast-success { background: #10b981; border-left: 5px solid #047857; }
        .v-toast-error { background: #ef4444; border-left: 5px solid #b91c1c; }
        .v-toast-info { background: #3b82f6; border-left: 5px solid #1d4ed8; }

        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Badge Badges */
        .v-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .v-badge-pendiente { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .v-badge-proceso { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .v-badge-transito { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .v-badge-completado { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
        .v-badge-cancelado { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }

        /* Current Trip Card styles */
        .v-curr-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .v-curr-body {
          display: flex;
          gap: 24px;
        }
        .v-curr-info { flex: 1; display: flex; flex-direction: column; gap: 16px; }
        .v-curr-map-wrapper { 
          width: 320px; 
          height: 280px; 
          border-radius: 12px; 
          overflow: hidden; 
          position: relative; 
          border: 1px solid var(--border-color);
        }
        @media (max-width: 768px) {
          .v-curr-body { flex-direction: column; }
          .v-curr-map-wrapper { width: 100%; height: 240px; }
        }

        .v-map-overlay {
          position: absolute;
          bottom: 12px;
          left: 12px;
          right: 12px;
          background: rgba(13, 13, 13, 0.85);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 8px 12px;
          border-radius: 8px;
          z-index: 1000;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: white;
          font-size: 11px;
          font-weight: 700;
        }

        /* Available trip cards */
        .v-disp-card {
          border: 1px solid var(--border-color);
          background: var(--bg-card);
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 14px;
          transition: all 0.2s;
        }
        .v-disp-card:hover {
          border-color: var(--border-dark);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .v-disp-tag-alta {
          color: #10b981;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 8px;
        }
        .v-disp-tag-ruta {
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }

        /* Agenda cards */
        .v-agenda-card {
          border: 1px solid var(--border-color);
          background: var(--bg-card);
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .v-agenda-card:hover {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.02);
        }
        .v-agenda-card.active {
          border-color: #10b981;
          box-shadow: 0 0 0 1px #10b981;
        }

        /* Checklist / Step Panel */
        .v-step-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 20px;
          margin-top: 16px;
        }
        .v-step-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
        }
        .v-step-row:last-of-type { border-bottom: none; }
        .v-step-checkbox {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          border: 2px solid var(--border-dark);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          background: var(--bg-main);
          color: white;
        }
        .v-step-row.checked .v-step-checkbox {
          background: #10b981;
          border-color: #10b981;
        }
        .v-step-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main);
          flex: 1;
        }
        .v-step-row.checked .v-step-label {
          color: var(--text-muted);
          text-decoration: line-through;
        }

        /* Modals style */
        .v-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20000;
          padding: 16px;
        }
        .v-modal {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          width: 100%;
          max-width: 480px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          animation: scaleUp 0.25s ease;
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .v-modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .v-modal-body {
          padding: 20px;
        }

        /* QR Laser scanner effect */
        .v-qr-scanner-box {
          position: relative;
          width: 100%;
          height: 220px;
          background: #111;
          border-radius: 12px;
          overflow: hidden;
          border: 2px dashed rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .v-qr-laser {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: #10b981;
          box-shadow: 0 0 10px #10b981, 0 0 20px #10b981;
          animation: laserScan 2s infinite linear;
        }
        @keyframes laserScan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }

        /* Compact elements for layout optimization */
        .v-sec-title-box {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .v-count-badge {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
        }
        .v-count-badge-neutral {
          background: var(--border-color);
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
        }

        /* Table custom compact formatting */
        .v-history-table {
          width: 100%;
          border-collapse: collapse;
        }
        .v-history-table th, .v-history-table td {
          padding: 12px 16px;
          text-align: left;
          font-size: 13px;
        }
        .v-history-table tr {
          border-bottom: 1px solid var(--border-color);
        }
        .v-history-table tr:last-child {
          border-bottom: none;
        }

        /* Custom buttons */
        .v-btn-toggle {
          background: var(--border-color);
          border-radius: 8px;
          padding: 4px;
          display: inline-flex;
          gap: 4px;
        }
        .v-btn-toggle-option {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          border-radius: 6px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }
        .v-btn-toggle-option.active {
          background: var(--bg-card);
          color: var(--text-main);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
      `}</style>

      <div className="container">
        {/* Toast Alerts System */}
        {notification && (
          <div className={`v-toast v-toast-${notification.type}`}>
            {notification.type === "success" && <Check size={18} />}
            {notification.type === "error" && <X size={18} />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Dynamic header / breadcrumbs */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          <h2>Centro Logístico • Viajes</h2>
          {error && <div className="alert alert-error" style={{ margin: 0, padding: "8px 16px", fontSize: 13 }}>{error}</div>}
        </div>

        {/* Dashboard Grid Criss-Cross Layout with mobile active tab class wrapper */}
        <div className={`v-dash-grid mobile-tab-${mobileTab}`}>
          
          {/* 1. SECTION: Viaje en Curso / Detalle (Top Left - Spans 8) */}
          <div className="grid-left-main">
            <div className="card" style={{ height: "100%", margin: 0 }}>
              {activeTrip ? (
                <>
                  <div className="v-curr-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className={statusBadge(activeTrip.estado)}>
                        {STATUS_LABELS[activeTrip.estado] || activeTrip.estado}
                      </span>
                      <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
                        {activeTrip.codigoViaje}
                      </h3>
                    </div>
                    
                    <div style={{ display: "flex", gap: 8 }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: "6px 12px", fontSize: 12 }} 
                        onClick={() => router.push(`/viajes/${activeTrip.id}/manifiesto`)}
                      >
                        <ClipboardText size={15} /> Manifiesto
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: "6px 12px", fontSize: 12, background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)" }} 
                        onClick={() => setIsReportModalOpen(true)}
                      >
                        <Warning size={15} /> Reportar Problema
                      </button>
                    </div>
                  </div>

                  <div className="v-curr-body">
                    {/* Left: Text Info */}
                    <div className="v-curr-info">
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.08em" }}>ORIGEN</span>
                        <p style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "var(--text-main)" }}>{activeTrip.almacen?.name || "No especificado"}</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{activeTrip.almacen?.address || "Guatemala"}</p>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.08em" }}>DESTINO</span>
                        <p style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "var(--text-main)" }}>{activeTrip.centroAyuda?.name || "No especificado"}</p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{activeTrip.centroAyuda?.address || "Guatemala"}</p>
                      </div>

                      <div style={{ display: "flex", gap: 16, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.08em" }}>INSUMOS</span>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginTop: 4 }}>
                            {insumosText(activeTrip) || "Sin insumos asignados"}
                          </p>
                        </div>
                      </div>

                      {/* Navigation buttons */}
                      <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 12 }}>
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&origin=MY_POSITION&destination=${encodeURIComponent(activeTrip.centroAyuda?.address || "")}&waypoints=${encodeURIComponent(activeTrip.almacen?.address || "")}&travelmode=driving`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-secondary" 
                          style={{ flex: 1, fontSize: 12, background: "var(--bg-main)", border: "1px solid var(--border-color)", color: "var(--text-main)", padding: "8px 12px" }}
                        >
                          <NavigationArrow size={16} /> Google Maps
                        </a>
                        <a 
                          href={`https://waze.com/ul?q=${encodeURIComponent(activeTrip.centroAyuda?.address || "")}&navigate=yes`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-secondary" 
                          style={{ flex: 1, fontSize: 12, background: "var(--bg-main)", border: "1px solid var(--border-color)", color: "var(--text-main)", padding: "8px 12px" }}
                        >
                          <MapTrifold size={16} /> Waze
                        </a>
                      </div>

                    </div>

                    {/* Right: Map */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div className="v-curr-map-wrapper">
                        <div id="active-trip-map" style={{ width: "100%", height: "100%", background: "#222" }} />
                        <div className="v-map-overlay">
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><NavigationArrow size={12} /> DISTANCIA RESTANTE</span>
                          <span>{getMockDistance()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Contacts Section */}
                  {(activeTrip.estado === "assigned" || activeTrip.estado === "in_transit" || activeTrip.estado === "delivered") && (
                    <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 16, marginTop: 20 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                        CONTACTOS DE WHATSAPP
                      </span>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                        {actor?.type !== "warehouse" && activeTrip.almacen && (
                          <div style={{ background: "var(--bg-main)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)" }}>ALMACÉN</span>
                              <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-main)", lineHeight: "1.2" }}>{activeTrip.almacen.name}</p>
                              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0 0" }}>{activeTrip.almacen.whatsapp || "—"}</p>
                            </div>
                            {activeTrip.almacen.whatsapp ? (
                              <a 
                                href={`https://wa.me/${activeTrip.almacen.whatsapp.replace(/[^0-9]/g, "")}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ fontSize: 12, color: "#25D366", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                WhatsApp
                              </a>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                            )}
                          </div>
                        )}
                        {actor?.type !== "relief" && activeTrip.centroAyuda && (
                          <div style={{ background: "var(--bg-main)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)" }}>CENTRO AYUDA</span>
                              <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-main)", lineHeight: "1.2" }}>{activeTrip.centroAyuda.name}</p>
                              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0 0" }}>{activeTrip.centroAyuda.whatsapp || "—"}</p>
                            </div>
                            {activeTrip.centroAyuda.whatsapp ? (
                              <a 
                                href={`https://wa.me/${activeTrip.centroAyuda.whatsapp.replace(/[^0-9]/g, "")}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ fontSize: 12, color: "#25D366", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                WhatsApp
                              </a>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                            )}
                          </div>
                        )}
                        {actor?.type !== "transporter" && activeTrip.transportista && (
                          <div style={{ background: "var(--bg-main)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)" }}>TRANSPORTISTA</span>
                              <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--text-main)", lineHeight: "1.2" }}>{activeTrip.transportista.name}</p>
                              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0 0" }}>{activeTrip.transportista.whatsapp || "—"}</p>
                            </div>
                            {activeTrip.transportista.whatsapp ? (
                              <a 
                                href={`https://wa.me/${activeTrip.transportista.whatsapp.replace(/[^0-9]/g, "")}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ fontSize: 12, color: "#25D366", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                WhatsApp
                              </a>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTrip && (activeTrip.estado === "assigned" || activeTrip.estado === "in_transit") && actor?.type === "transporter" && (
                    <div style={{ borderTop: "1px solid var(--border-color)", marginTop: 20, paddingTop: 16 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6, color: "var(--text-main)" }}>
                        <CheckCircle size={16} style={{ color: "#10b981" }} /> Próximos Pasos (Tarea Actual)
                      </h4>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, flex: 1, minWidth: 240, lineHeight: "1.5" }}>
                          {activeTrip.estado === "in_transit" 
                            ? "El viaje está en tránsito. Una vez que hayas entregado los insumos en el Centro de Ayuda, presiona el botón para finalizar la entrega."
                            : "El viaje está asignado. Debes iniciar el tránsito para activar el protocolo de entrega."
                          }
                        </p>
                        <button 
                          className="btn btn-success" 
                          style={{ padding: "10px 24px", background: "#10b981", borderColor: "#10b981", color: "#ffffff", minWidth: 160 }}
                          onClick={() => updateStatus(activeTrip.id, activeTrip.estado === "in_transit" ? "delivered" : "in_transit")}
                        >
                          {activeTrip.estado === "in_transit" ? "FINALIZAR ENTREGA" : "INICIAR TRÁNSITO"}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTrip && (activeTrip.estado === "proposed" || activeTrip.estado === "approved") && (actor?.type === "warehouse" || actor?.type === "relief") && (
                    <div style={{ borderTop: "1px solid var(--border-color)", marginTop: 20, paddingTop: 16 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6, color: "var(--text-main)" }}>
                        <CheckCircle size={16} style={{ color: "#10b981" }} /> Próximos Pasos (Tarea Actual)
                      </h4>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, flex: 1, minWidth: 240, lineHeight: "1.5" }}>
                          {activeTrip.estado === "proposed" 
                            ? (actor?.type === "warehouse" 
                              ? "Este envío ha sido propuesto. Como almacén de origen, debes aceptar/aprobar el envío para que un transportista pueda tomarlo."
                              : "Este envío ha sido propuesto y está esperando aprobación por parte del almacén.")
                            : "Este envío está aprobado y en espera de ser asignado o tomado por un transportista voluntario."
                          }
                        </p>
                        
                        <div style={{ display: "flex", gap: 8 }}>
                          {actor?.type === "warehouse" && activeTrip.estado === "proposed" && actor?.id === activeTrip.almacen?.id && (
                            <button 
                              className="btn btn-success" 
                              style={{ padding: "10px 24px", background: "#10b981", borderColor: "#10b981", color: "#ffffff", fontWeight: 700 }}
                              onClick={() => updateStatus(activeTrip.id, "approved")}
                            >
                              ACEPTAR ENVÍO
                            </button>
                          )}
                          
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: "10px 24px", background: "#ef4444", borderColor: "#ef4444", color: "#ffffff", fontWeight: 700 }}
                            onClick={() => {
                              if (confirm("¿Estás seguro de que deseas cancelar este envío?")) {
                                updateStatus(activeTrip.id, "cancelled");
                              }
                            }}
                          >
                            CANCELAR ENVÍO
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "48px 24px" }}>
                  <Truck size={48} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>No tienes ningún viaje activo</h3>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, maxWidth: 380, marginInline: "auto" }}>
                    Toma un envío de la lista de disponibles, o selecciona uno agendado para visualizar el recorrido y mapa detallado.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 2. SECTION: Agenda Próxima & Checklist (Top Right - Spans 4) */}
          <div className="grid-right-side">
            <div className="v-sec-title-box">
              <h3 style={{ fontSize: 15, fontWeight: 800 }}>Agenda Próxima</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="v-count-badge-neutral">{agendaTrips.length} VIAJES</span>
                <div className="v-btn-toggle">
                  <button 
                    className={`v-btn-toggle-option ${agendaFilter === "todos" ? "active" : ""}`}
                    onClick={() => setAgendaFilter("todos")}
                  >
                    Todos
                  </button>
                  <button 
                    className={`v-btn-toggle-option ${agendaFilter === "en-transito" ? "active" : ""}`}
                    onClick={() => setAgendaFilter("en-transito")}
                  >
                    En Tránsito
                  </button>
                </div>
              </div>
            </div>

            {agendaTrips.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "24px 16px" }}>
                <Clock size={24} style={{ color: "var(--text-muted)", marginBottom: 8 }} />
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No hay viajes asignados o activos.</p>
              </div>
            ) : (
              agendaTrips.map((t: any) => (
                <div 
                  key={t.id} 
                  className={`v-agenda-card ${activeTrip?.id === t.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedTripId(t.id);
                    // On mobile, clicking a trip card auto-focuses/switches to active view to show its map details
                    const isMobile = window.innerWidth <= 768;
                    if (isMobile) setMobileTab("activo");
                  }}
                >
                  <div style={{ display: "flex", alignItems: "start", gap: 10 }}>
                    <div style={{ marginTop: 2, color: t.estado === "in_transit" ? "#10b981" : "var(--text-muted)" }}>
                      <Clock size={16} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)" }}>
                          {formatDate(t.createdAt).toUpperCase()}
                        </span>
                        <span className={`v-badge ${t.estado === "in_transit" ? "v-badge-transito" : "v-badge-pendiente"}`} style={{ fontSize: 9, padding: "2px 6px" }}>
                          {STATUS_LABELS[t.estado] || t.estado}
                        </span>
                      </div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: "var(--text-main)" }}>
                        {t.centroAyuda?.name || "Refugio"}
                      </h4>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {t._insumosText || "Carga de ayuda"}
                      </p>
                    </div>
                  </div>
                  <CaretRight size={16} style={{ color: "var(--text-muted)" }} />
                </div>
              ))
            )}


          </div>

          {/* 3. SECTION: Envíos Disponibles (Bottom Left - Spans 4) */}
          <div className="grid-left-small">
            <div className="card" style={{ height: "100%", margin: 0, display: "flex", flexDirection: "column" }}>
              <div className="v-sec-title-box">
                <h3 style={{ fontSize: 15, fontWeight: 800 }}>Envíos Disponibles</h3>
                {disponibles.length > 0 && <span className="v-count-badge">{disponibles.length} NUEVOS</span>}
              </div>

              {actor.type !== "transporter" ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "16px" }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Sección exclusiva para transportistas.</p>
                </div>
              ) : disponibles.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "16px" }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No hay envíos libres disponibles por ahora.</p>
                </div>
              ) : (
                <div style={{ overflowY: "auto", maxHeight: "340px", flex: 1, paddingRight: 4 }}>
                  <TableSearch value={searchDisponibles} onChange={setSearchDisponibles} placeholder="Filtrar disponibles..." />
                  
                  {sortedDisponibles.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No se encontraron coincidencias.</p>
                  ) : (
                    sortedDisponibles.map((t: any) => {
                      const isEmergency = t._insumosText.toLowerCase().includes("urgente") || t._insumosText.toLowerCase().includes("emergencia") || t._insumosText.toLowerCase().includes("medico");
                      return (
                        <div key={t.id} className="v-disp-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                            {isEmergency ? (
                              <span className="v-disp-tag-alta">PRIORIDAD ALTA</span>
                            ) : (
                              <span className="v-disp-tag-ruta">RUTA COMERCIAL</span>
                            )}
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#10b981" }}>{getMockReward(t)}</span>
                          </div>
                          
                          <h4 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-main)", marginBottom: 4 }}>
                            {t.almacen?.name?.split(" ")[0]} → {t.centroAyuda?.name?.split(" ")[0]}
                          </h4>
                          
                          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: "1.4" }}>
                            {t.notes && !t.notes.startsWith("VIA-") ? t.notes : `Transporte general. Insumos: ${t._insumosText}.`} • {getMockWeight(t)}
                          </p>
                          
                          <button 
                            className="btn btn-success" 
                            style={{ width: "100%", padding: "8px 16px", background: "#10b981", borderColor: "#10b981", color: "#ffffff" }}
                            onClick={() => assignTrip(t.id)}
                          >
                            Tomar Envío
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 4. SECTION: Historial de Envíos (Bottom Right - Spans 8) */}
          <div className="grid-right-main">
            <div className="card" style={{ height: "100%", margin: 0 }}>
              <div className="v-sec-title-box">
                <h3 style={{ fontSize: 15, fontWeight: 800 }}>Historial de Envíos</h3>
                
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: "6px 12px", fontSize: 12, background: "var(--bg-main)", border: "1px solid var(--border-color)", color: "var(--text-main)" }} 
                    onClick={handleExportToCSV}
                    title="Exportar Historial"
                  >
                    <Download size={15} /> Exportar CSV
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <TableSearch value={searchTrips} onChange={(v) => { setSearchTrips(v); setHistoryPage(1); }} placeholder="Buscar en historial..." />
              </div>

              {paginatedHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No hay registros de viajes finalizados en el historial.</p>
                </div>
              ) : (
                <>
                  <div className="table-wrapper">
                    <table className="v-history-table">
                      <thead>
                        <tr>
                          <SortHeaderHistory label="CÓDIGO" sortKey="codigoViaje" />
                          <SortHeaderHistory label="CENTRO / DESTINO" sortKey="_centro" />
                          <SortHeaderHistory label="INSUMOS" sortKey="_insumosText" />
                          <SortHeaderHistory label="ESTADO" sortKey="estado" />
                          <SortHeaderHistory label="FECHA" sortKey="updatedAt" />
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedHistory.map((t: any) => (
                          <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => {
                            setSelectedTripId(t.id);
                            // On mobile, selecting an item shifts view back to active card to show detailed trip and polyline map
                            const isMobile = window.innerWidth <= 768;
                            if (isMobile) setMobileTab("activo");
                          }}>
                            <td><strong>{t.codigoViaje}</strong></td>
                            <td>{t.centroAyuda?.name || "N/A"}</td>
                            <td style={{ fontSize: 12 }}>{t._insumosText}</td>
                            <td>
                              <span className={statusBadge(t.estado)}>
                                {STATUS_LABELS[t.estado] || t.estado}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                              {formatDate(t.updatedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Pagination footer */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Mostrando {Math.min(totalHistoryCount, (historyPage - 1) * itemsPerPage + 1)} a {Math.min(totalHistoryCount, historyPage * itemsPerPage)} de {totalHistoryCount} registros
                    </span>
                    
                    <div style={{ display: "flex", gap: 6 }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: "6px 10px", fontSize: 12 }} 
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage(prev => Math.max(prev - 1, 1))}
                      >
                        <CaretLeft size={14} />
                      </button>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button
                          key={p}
                          className={`btn ${historyPage === p ? "btn-primary" : "btn-secondary"}`}
                          style={{ padding: "6px 12px", fontSize: 12, minWidth: 32 }}
                          onClick={() => setHistoryPage(p)}
                        >
                          {p}
                        </button>
                      ))}

                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: "6px 10px", fontSize: 12 }} 
                        disabled={historyPage === totalPages}
                        onClick={() => setHistoryPage(prev => Math.min(prev + 1, totalPages))}
                      >
                        <CaretRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* FIXED BOTTOM NAVIGATION BAR - Mobile Screen Only */}
      <div className="v-bottom-nav">
        <button 
          className={`v-bottom-nav-item ${mobileTab === "activo" ? "active" : ""}`}
          onClick={() => setMobileTab("activo")}
        >
          <Truck size={22} weight={mobileTab === "activo" ? "fill" : "regular"} />
          <span>Activo</span>
        </button>
        <button 
          className={`v-bottom-nav-item ${mobileTab === "agenda" ? "active" : ""}`}
          onClick={() => setMobileTab("agenda")}
        >
          <Clock size={22} weight={mobileTab === "agenda" ? "fill" : "regular"} />
          <span>Agenda</span>
        </button>
        {actor.type === "transporter" && (
          <button 
            className={`v-bottom-nav-item ${mobileTab === "disponibles" ? "active" : ""}`}
            onClick={() => setMobileTab("disponibles")}
          >
            <Package size={22} weight={mobileTab === "disponibles" ? "fill" : "regular"} />
            <span>Disponibles</span>
          </button>
        )}
        <button 
          className={`v-bottom-nav-item ${mobileTab === "historial" ? "active" : ""}`}
          onClick={() => setMobileTab("historial")}
        >
          <ClipboardText size={22} weight={mobileTab === "historial" ? "fill" : "regular"} />
          <span>Historial</span>
        </button>
      </div>



      {/* MODAL 2: Reportar Problema */}
      {isReportModalOpen && (
        <div className="v-modal-overlay" onClick={() => setIsReportModalOpen(false)}>
          <div className="v-modal" onClick={(e) => e.stopPropagation()}>
            <div className="v-modal-header">
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <Warning size={18} style={{ color: "#ef4444" }} /> Reportar Incidente / Problema
              </h3>
              <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }} onClick={() => setIsReportModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSendReport}>
              <div className="v-modal-body">
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                  Si tienes algún inconveniente en la ruta o con la carga, infórmalo inmediatamente para recibir apoyo y reprogramar la ruta si es necesario.
                </p>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Tipo de Incidente</label>
                  <select 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-dark)", background: "var(--bg-main)", color: "var(--text-main)", outline: "none", fontSize: "13px" }}
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <option value="retraso">Retraso por Tráfico / Bloqueo</option>
                    <option value="vehiculo">Falla Mecánica del Vehículo</option>
                    <option value="insumos">Problema con los Insumos (Dañados/Faltantes)</option>
                    <option value="accidente">Accidente Vial</option>
                    <option value="otro">Otro Motivo</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Descripción del Problema</label>
                  <textarea 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-dark)", background: "var(--bg-main)", color: "var(--text-main)", outline: "none", fontSize: "13px", height: "100px", resize: "none" }}
                    placeholder="Detalla lo sucedido para darte indicaciones exactas..."
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button 
                    type="button"
                    className="btn btn-secondary" 
                    style={{ flex: 1 }} 
                    onClick={() => setIsReportModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="btn btn-danger" 
                    style={{ flex: 1, background: "#ef4444", borderColor: "#ef4444" }}
                  >
                    Enviar Reporte
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
