"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Labels for actor types
const TYPE_LABELS: Record<string, string> = {
  warehouse: "Almacén",
  relief: "Centro de Ayuda",
  transporter: "Transportista",
};

interface Actor {
  id: string;
  name: string;
  type: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  vehicleType?: string | null;
  capacityKg?: number | null;
  phone?: string | null;
  whatsapp?: string | null;
}

interface MapComponentProps {
  containerId?: string;
  actors: Actor[];
  selectedActorId?: string | null;
  interactive?: boolean; // If true, allows clicking on the map to place a single marker (for registration)
  initialLat?: number;
  initialLng?: number;
  onLocationSelected?: (lat: number, lng: number) => void;
  onAddressFound?: (address: string, city: string) => void;
  onMapClick?: () => void;
  sidebarOpen?: boolean;
}

export default function MapComponent({
  containerId = "map-canvas",
  actors,
  selectedActorId,
  interactive = false,
  initialLat = 4.711,
  initialLng = -74.072,
  onLocationSelected,
  onAddressFound,
  onMapClick,
  sidebarOpen = false,
}: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const clickMarkerRef = useRef<L.Marker | null>(null);

  // Keep reference to the latest callbacks to avoid re-triggering the useEffect
  const onLocationSelectedRef = useRef(onLocationSelected);
  useEffect(() => {
    onLocationSelectedRef.current = onLocationSelected;
  }, [onLocationSelected]);

  const onAddressFoundRef = useRef(onAddressFound);
  useEffect(() => {
    onAddressFoundRef.current = onAddressFound;
  }, [onAddressFound]);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    // 1. Initialize map if not initialized
    if (!mapRef.current) {
      const map = L.map(containerId, {
        center: [initialLat, initialLng],
        zoom: 13,
        zoomControl: false,
      });

      // Add modern zoom control at bottom-right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Add a beautiful Mapbox/CartoDB clean map layer
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      mapRef.current = map;

      // Handle click events in interactive mode (registration)
      if (interactive) {
        map.on("click", (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;

          // Remove previous click marker
          if (clickMarkerRef.current) {
            map.removeLayer(clickMarkerRef.current);
          }

          // Create a new marker at click position
          const markerIcon = L.divIcon({
            html: `<div class="marker-pin warehouse-pin"><span class="icon-inner">📍</span></div>`,
            className: "custom-div-icon",
            iconSize: [38, 38],
            iconAnchor: [19, 38],
          });

          const newMarker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
          clickMarkerRef.current = newMarker;

          if (onLocationSelectedRef.current) {
            onLocationSelectedRef.current(lat, lng);
          }

          // Trigger reverse geocoding to automatically resolve address & city
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: {
              "User-Agent": "DisasterAcopioPortal/1.0"
            }
          })
            .then((r) => r.json())
            .then((data) => {
              if (data && data.address && onAddressFoundRef.current) {
                const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || "";
                
                // Construct a human-readable street address
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
                  formattedAddress = data.display_name?.split(",")[0] || "Ubicación en mapa";
                }

                onAddressFoundRef.current(formattedAddress, city);
              }
            })
            .catch((err) => console.error("Error in reverse geocoding:", err));
        });
      } else {
        map.on("click", () => {
          if (onMapClickRef.current) {
            onMapClickRef.current();
          }
        });
      }
    }

    return () => {
      // Clean up map on unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [containerId, interactive]);

  // Update markers when actors change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || interactive) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};

    const bounds: L.LatLngTuple[] = [];

    // Create markers for actors
    actors.forEach((actor) => {
      if (actor.lat === null || actor.lng === null) return;

      const position: L.LatLngTuple = [actor.lat, actor.lng];
      bounds.push(position);

      // Decide icon details based on actor type
      let emoji = "🏠";
      let pinClass = "warehouse-pin";

      if (actor.type === "relief") {
        emoji = "❤️";
        pinClass = "relief-pin";
      } else if (actor.type === "transporter") {
        emoji = "🚚";
        pinClass = "transporter-pin";
      }

      const customIcon = L.divIcon({
        html: `<div class="marker-pin ${pinClass}"><span class="icon-inner">${emoji}</span></div>`,
        className: "custom-div-icon",
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38],
      });

      // Construct detailed popup
      let popupContent = `
        <div class="popup-card">
          <span class="type-badge ${pinClass}">${TYPE_LABELS[actor.type] || actor.type}</span>
          <h4>${actor.name}</h4>
          <p><strong>Dirección:</strong> ${actor.address || "No especificada"}</p>
          <p><strong>Ciudad:</strong> ${actor.city || "No especificada"}</p>
      `;

      if (actor.type === "transporter" && actor.vehicleType) {
        popupContent += `<p><strong>Vehículo:</strong> ${actor.vehicleType} (${actor.capacityKg || 0} kg)</p>`;
      }

      if (actor.phone || actor.whatsapp) {
        popupContent += `<p><strong>Contacto:</strong> ${actor.phone || actor.whatsapp}</p>`;
      }

      popupContent += `</div>`;

      const marker = L.marker(position, { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent);

      markersRef.current[actor.id] = marker;
    });

    // Fit bounds if there are markers
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [actors, interactive]);

  // Pan to selected actor
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedActorId) return;

    const marker = markersRef.current[selectedActorId];
    if (marker) {
      const position = marker.getLatLng();
      
      const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
      if (isMobile) {
        // Offset the map center so the marker is centered in the visible top area
        const targetZoom = 15;
        const projectedPoint = map.project(position, targetZoom);
        const mapHeight = map.getSize().y;
        
        // When expanded, the sidebar takes up 75% height. Visually center at top 25% (offset by 37.5%).
        // When collapsed, the sidebar takes up 182px. Visually center above 182px (offset by 91px).
        const pixelOffset = sidebarOpen ? (mapHeight * 0.375) : 91;
        
        const projectedPointWithOffset = L.point(projectedPoint.x, projectedPoint.y + pixelOffset);
        const targetLatLngWithOffset = map.unproject(projectedPointWithOffset, targetZoom);
        
        map.setView(targetLatLngWithOffset, targetZoom, { animate: true, duration: 1 });
      } else {
        map.setView(position, 15, { animate: true, duration: 1 });
      }
      
      marker.openPopup();
    }
  }, [selectedActorId, sidebarOpen]);

  return <div id={containerId} style={{ width: "100%", height: "100%" }} />;
}
