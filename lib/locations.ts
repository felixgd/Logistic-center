/**
 * List of Venezuelan states and key municipalities/cities
 * focused on the earthquake-affected region and main logistical hubs.
 */
export const VENEZUELAN_LOCATIONS: Record<string, string[]> = {
  "Sucre": [
    "Cariaco",
    "Cumaná",
    "Carúpano",
    "Río Caribe",
    "Güiria",
    "Casanay",
    "Araya",
    "El Pilar",
    "Yaguaraparo"
  ],
  "Monagas": [
    "Maturín",
    "Caripe",
    "Caripito",
    "Punta de Mata",
    "Temblador",
    "Quiriquire",
    "Caicara de Maturín"
  ],
  "Nueva Esparta": [
    "Porlamar",
    "La Asunción",
    "Pampatar",
    "Juan Griego",
    "Punta de Piedras",
    "San Juan Bautista"
  ],
  "Distrito Capital": [
    "Caracas"
  ],
  "Miranda": [
    "Chacao",
    "Baruta",
    "Sucre (Petare)",
    "El Hatillo",
    "Guarenas",
    "Guatire",
    "Los Teques",
    "Ocumare del Tuy",
    "Charallave"
  ],
  "Anzoátegui": [
    "Barcelona",
    "Puerto La Cruz",
    "Lechería",
    "Guanta",
    "El Tigre",
    "Anaco",
    "Cantaura",
    "Píritu"
  ],
  "Bolívar": [
    "Ciudad Bolívar",
    "Ciudad Guayana (Puerto Ordaz)",
    "Upata",
    "Caicara del Orinoco"
  ]
};

export const DEFAULT_STATE = "Sucre";
export const DEFAULT_CITY = "Cariaco";
