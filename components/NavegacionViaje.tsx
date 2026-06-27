"use client";

const GOOGLE_MAPS_KEY = "";

function encodeAddress(a: { address?: string | null; lat?: number | null; lng?: number | null }) {
  if (a.lat && a.lng) return `${a.lat},${a.lng}`;
  return encodeURIComponent(a.address || "");
}

export default function NavegacionViaje({
  origen,
  destino,
}: {
  origen: { nombre: string; address?: string | null; lat?: number | null; lng?: number | null };
  destino: { nombre: string; address?: string | null; lat?: number | null; lng?: number | null };
}) {
  const from = encodeAddress(origen);
  const to = encodeAddress(destino);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=MY_POSITION&destination=${to}&waypoints=${from}&travelmode=driving`;
  const wazeUrl = `https://waze.com/ul?q=${to}&navigate=yes`;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ textDecoration: "none", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        Google Maps
      </a>
      <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: "none", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.56 3.91c.59.59.59 1.54 0 2.12l-3.89 3.89L12 5.33l4.47-4.47c.59-.59 1.54-.59 2.12 0l1.97 1.05zM3.91 20.56c-.59-.59-.59-1.54 0-2.12l3.89-3.89L5.33 12l-4.47 4.47c-.59.59-.59 1.54 0 2.12l1.05 1.97zM12 5.33l-7.3 7.3c-.39.39-.39 1.02 0 1.41l5.66 5.66c.39.39 1.02.39 1.41 0l7.3-7.3L12 5.33z"/></svg>
        Waze
      </a>
    </div>
  );
}
