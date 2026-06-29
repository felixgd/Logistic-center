const ALLOWED_UNITS: Record<string, string> = {
  unidad: "unidad", unidades: "unidad",
  kg: "kg", kilo: "kg", kilos: "kg", kilogramo: "kg", kilogramos: "kg",
  litro: "litro", litros: "litro",
  caja: "caja", cajas: "caja",
  palet: "palet", palets: "palet",
  paquete: "paquete", paquetes: "paquete",
};

const ALLOWED_URGENCIES = ["baja", "media", "alta", "critica"];

export function sanitizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value).trim();
  // Eliminar caracteres de control y null bytes
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Escapar caracteres peligrosos para prevenir XSS/inyecciones
  str = str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  // Limitar longitud
  return str.slice(0, 500);
}

export function normalizeUnit(unit: unknown): string {
  if (!unit) return "unidad";
  const key = String(unit).trim().toLowerCase();
  return ALLOWED_UNITS[key] || sanitizeText(unit);
}

export function validateQuantity(value: unknown): { valid: true; quantity: number } | { valid: false; error: string } {
  const num = Number(value);
  if (isNaN(num)) return { valid: false, error: "La cantidad debe ser un número válido" };
  if (num < 0) return { valid: false, error: "La cantidad no puede ser menor a 0" };
  return { valid: true, quantity: num };
}

export function validateUrgency(value: unknown): { valid: true; urgency: string } | { valid: false; error: string } {
  const urgency = String(value || "media").trim().toLowerCase();
  if (!ALLOWED_URGENCIES.includes(urgency)) {
    return { valid: false, error: "La urgencia debe ser baja, media, alta o crítica" };
  }
  return { valid: true, urgency };
}
