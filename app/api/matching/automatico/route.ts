import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";

function distancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return -1;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}

export async function POST(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");
  if (auth.actorType !== "warehouse") return jsonError(403, "Solo los almacenes pueden usar el matching");

  try {
    const resultados: any[] = [];

    if (auth.actorType === "warehouse") {
      // Warehouse: match own supplies against open requests
      const supplies = await prisma.supply.findMany({
        where: { status: "available", quantity: { gt: 0 }, actorId: auth.actorId },
        include: { actor: { select: { id: true, name: true, lat: true, lng: true } } },
      });
      if (supplies.length === 0) {
        return Response.json({ totalMatches: 0, matches: [], mensaje: "No tienes insumos disponibles para match." });
      }

      const pendientes = await prisma.request.findMany({
        where: { status: "open" },
        include: { actor: { select: { name: true, lat: true, lng: true } } },
        orderBy: [{ urgency: "asc" }, { createdAt: "asc" }],
      });

      for (const r of pendientes) {
        const matchingSupplies = supplies.filter(
          (s) =>
            s.unit.toLowerCase() === r.unit.toLowerCase() &&
            (r.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(r.name.toLowerCase()))
        );
        if (matchingSupplies.length > 0) {
          resultados.push({
            requestId: r.id,
            reliefActorId: r.actorId,
            centroAyuda: r.actor.name,
            urgencia: r.urgency,
            categoria: r.category,
            insumo: r.name,
            cantidad: r.quantity,
            almacenes: matchingSupplies.map((s) => ({
              almacenId: s.actor.id,
              nombre: s.actor.name,
              supplyId: s.id,
              cantidadDisponible: s.quantity,
              unidad: s.unit,
              distancia: distancia(s.actor.lat || 0, s.actor.lng || 0, r.actor.lat || 0, r.actor.lng || 0),
            })),
          });
        }
      }
    } else if (auth.actorType === "relief") {
      // Relief center: match own requests against available supplies from warehouses
      const pendientes = await prisma.request.findMany({
        where: { status: "open", actorId: auth.actorId },
        include: { actor: { select: { name: true, lat: true, lng: true } } },
        orderBy: [{ urgency: "asc" }, { createdAt: "asc" }],
      });

      if (pendientes.length === 0) {
        return Response.json({ totalMatches: 0, matches: [], mensaje: "No tienes solicitudes abiertas para match." });
      }

      const supplies = await prisma.supply.findMany({
        where: {
          status: "available",
          quantity: { gt: 0 },
          actorId: { not: auth.actorId },
        },
        include: { actor: { select: { id: true, name: true, lat: true, lng: true } } },
      });

      for (const r of pendientes) {
        const matchingSupplies = supplies.filter(
          (s) =>
            s.unit.toLowerCase() === r.unit.toLowerCase() &&
            (r.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(r.name.toLowerCase()))
        );
        if (matchingSupplies.length > 0) {
          resultados.push({
            requestId: r.id,
            reliefActorId: r.actorId,
            centroAyuda: r.actor.name,
            urgencia: r.urgency,
            categoria: r.category,
            insumo: r.name,
            cantidad: r.quantity,
            almacenes: matchingSupplies.map((s) => ({
              almacenId: s.actor.id,
              nombre: s.actor.name,
              supplyId: s.id,
              cantidadDisponible: s.quantity,
              unidad: s.unit,
              distancia: distancia(s.actor.lat || 0, s.actor.lng || 0, r.actor.lat || 0, r.actor.lng || 0),
            })),
          });
        }
      }
    }

    await publishEvent("matching.automatico.completado", {
      timestamp: new Date().toISOString(),
      solicitudesMatch: resultados.length,
    });

    if (resultados.length === 0) {
      return Response.json({ totalMatches: 0, matches: [], mensaje: "No se encontraron almacenes con insumos que coincidan con tus solicitudes abiertas." });
    }

    return Response.json({ totalMatches: resultados.length, matches: resultados });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
