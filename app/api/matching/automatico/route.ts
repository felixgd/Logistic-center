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

  try {
    // Only match using this warehouse's own supplies
    const supplies = await prisma.supply.findMany({
      where: {
        status: "available",
        quantity: { gt: 0 },
        actorId: auth.actorId,
      },
      include: { actor: { select: { id: true, name: true, lat: true, lng: true } } },
    });

    if (supplies.length === 0) {
      return Response.json({ totalMatches: 0, matches: [], mensaje: "No tienes insumos disponibles para match." });
    }

    const supplyNames = supplies.map((s) => s.name.toLowerCase());
    const supplyUnits = supplies.map((s) => s.unit.toLowerCase());

    const pendientes = await prisma.request.findMany({
      where: {
        status: "open",
        OR: supplyNames.map((name) => ({ name: { contains: name, mode: "insensitive" } })),
      },
      include: { actor: { select: { name: true, lat: true, lng: true } } },
      orderBy: [{ urgency: "asc" }, { createdAt: "asc" }],
    });

    const resultados: any[] = [];

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
            distancia: distancia(s.actor.lat || 0, s.actor.lng || 0, r.actor.lat || 0, r.actor.lng || 0),
          })),
        });
      }
    }

    await publishEvent("matching.automatico.completado", {
      timestamp: new Date().toISOString(),
      solicitudesMatch: resultados.length,
    });

    return Response.json({ totalMatches: resultados.length, matches: resultados });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
