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

// Pure SVG markup for Phosphor Icons to render inside Leaflet divIcons
const PIN_SVGs: Record<string, string> = {
  warehouse: `<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M218.83,103.77l-80-75.06a16,16,0,0,0-21.66,0l-80,75.06A16,16,0,0,0,32,115.55V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V115.55A16,16,0,0,0,218.83,103.77ZM144,208H112V160h32Z"></path></svg>`,
  relief: `<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M240,94c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,220.66,16,164,16,94A62,62,0,0,1,122,51.81,62,62,0,0,1,228,94,61.79,61.79,0,0,1,240,94Z"></path></svg>`,
  transporter: `<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M240,116.14V192a16,16,0,0,1-16,16H206.51a32,32,0,0,1-61,0H110.51a32,32,0,0,1-61,0H32a16,16,0,0,1-16-16V64A16,16,0,0,1,32,48H168a16,16,0,0,1,16,16v56h40.51A15.93,15.93,0,0,1,240,116.14ZM80,184a16,16,0,1,0,16,16A16,16,0,0,0,80,184Zm96,0a16,16,0,1,0,16,16A16,16,0,0,0,176,184Z"></path></svg>`
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
  initialLat = 10.5925,
  initialLng = -66.9317,
  onLocationSelected,
  onAddressFound,
  onMapClick,
  sidebarOpen = false,
}: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const clickMarkerRef = useRef<L.Marker | null>(null);
  const hasFitBoundsRef = useRef(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "data-theme" && tileLayerRef.current) {
          const isDark = document.documentElement.getAttribute("data-theme") === "dark";
          tileLayerRef.current.setUrl(
            isDark
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          );
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

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

      // Try to get user location if they didn't pass explicitly customized coordinates
      const isDefaultCoords = initialLat === 10.5925 && initialLng === -66.9317;
      if (isDefaultCoords && typeof window !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            map.setView([userLat, userLng], 13);

            // Render a beautiful green circle with opacity on user's location (no standard pins)
            const userPos: L.LatLngTuple = [userLat, userLng];
            L.circle(userPos, {
              radius: 200,
              color: "#10b981",
              fillColor: "#10b981",
              fillOpacity: 0.15,
              weight: 1,
            }).addTo(map);

            const userIcon = L.divIcon({
              html: `<div style="background:#10b981;width:12px;height:12px;border:2px solid #ffffff;border-radius:50%;box-shadow:0 0 8px rgba(16,185,129,0.6);"></div>`,
              className: "custom-user-gps-dot",
              iconSize: [12, 12],
              iconAnchor: [6, 6],
            });
            L.marker(userPos, { icon: userIcon }).addTo(map).bindPopup("<strong>Tu Ubicación Actual</strong>");
          },
          (err) => {
            console.log("Geolocation permission denied, using default La Guaira, Venezuela.");
          }
        );
      }

      // Add modern zoom control at bottom-right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Add a beautiful Mapbox/CartoDB clean map layer
      const isDarkTheme = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
      const tileLayer = L.tileLayer(
        isDarkTheme
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }
      ).addTo(map);
      tileLayerRef.current = tileLayer;

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
            html: `<div class="marker-pin warehouse-pin"><span class="icon-inner" style="display: flex; align-items: center; justify-content: center; color: #4b5563; width: 100%; height: 100%;">${PIN_SVGs.warehouse}</span></div>`,
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

    const bounds: L.LatLngTuple[] = [];
    const currentActorIds = new Set(actors.map((a) => a.id));

    // 1. Remove markers that are no longer in the new actors array
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentActorIds.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    // 2. Add or update markers for current actors
    actors.forEach((actor) => {
      if (actor.lat === null || actor.lng === null) return;

      const position: L.LatLngTuple = [actor.lat, actor.lng];
      bounds.push(position);

      // Decide icon details based on actor type
      let svgMarkup = PIN_SVGs.warehouse;
      let pinClass = "warehouse-pin";
      let iconColor = "#4b5563";

      if (actor.type === "relief") {
        svgMarkup = PIN_SVGs.relief;
        pinClass = "relief-pin";
        iconColor = "#ef4444";
      } else if (actor.type === "transporter") {
        svgMarkup = PIN_SVGs.transporter;
        pinClass = "transporter-pin";
        iconColor = "#f59e0b";
      }

      // Construct detailed popup
      let popupContent = `
        <div class="popup-card">
          <span class="type-badge ${pinClass}">${TYPE_LABELS[actor.type] || actor.type}</span>
          <h4>${actor.name}</h4>
          <div class="popup-info-grid" style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
            <p style="margin: 0;"><strong>Dirección:</strong> ${actor.address || "No especificada"}</p>
            <p style="margin: 0;"><strong>Ciudad:</strong> ${actor.city || "No especificada"}</p>
      `;

      if (actor.type === "transporter" && actor.vehicleType) {
        popupContent += `<p style="margin: 0;"><strong>Vehículo:</strong> ${actor.vehicleType} (${actor.capacityKg || 0} kg)</p>`;
      }

      if (actor.phone || actor.whatsapp) {
        popupContent += `<p style="margin: 0;"><strong>Contacto:</strong> ${actor.phone || actor.whatsapp}</p>`;
      }

      popupContent += `</div>`; // Close popup-info-grid

      // Actions row inside popup
      popupContent += `<div class="popup-actions" style="margin-top: 12px; display: flex; gap: 8px;">`;
      if (actor.whatsapp) {
        popupContent += `
          <a href="https://wa.me/${actor.whatsapp.replace(/\D/g, "")}" target="_blank" class="btn btn-success" style="flex: 1; padding: 6px 8px; font-size: 11px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;">
            WhatsApp
          </a>
        `;
      }
      popupContent += `
        <button class="btn btn-secondary" onclick="window.dispatchEvent(new CustomEvent('select-actor', {detail: '${actor.id}'}))" style="flex: 1; padding: 6px 8px; font-size: 11px; border-radius: 8px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; outline: none;">
          Actividad
        </button>
      `;
      popupContent += `</div>`; // Close popup-actions

      popupContent += `</div>`; // Close popup-card

      const existingMarker = markersRef.current[actor.id];
      const customIcon = L.divIcon({
        html: `<div class="marker-pin ${pinClass}"><span class="icon-inner" style="display: flex; align-items: center; justify-content: center; color: ${iconColor}; width: 100%; height: 100%;">${svgMarkup}</span></div>`,
        className: "custom-div-icon",
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38],
      });

      if (existingMarker) {
        // Update marker in place to prevent layout shifts or popup closures
        existingMarker.setLatLng(position);
        existingMarker.setPopupContent(popupContent);
        existingMarker.setIcon(customIcon);
      } else {
        // Instantiate a new marker
        const marker = L.marker(position, { icon: customIcon })
          .addTo(map)
          .bindPopup(popupContent);

        markersRef.current[actor.id] = marker;
      }
    });

    // 3. Fit bounds only once on initial map load/markers population
    if (bounds.length > 0 && !hasFitBoundsRef.current) {
      map.fitBounds(bounds, { 
        paddingTopLeft: [390, 50],
        paddingBottomRight: [50, 50],
        maxZoom: 15 
      });
      hasFitBoundsRef.current = true;
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
