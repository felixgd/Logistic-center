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

export async function GET(req: NextRequest, { params }: { params: { solicitudId: string } }) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const solicitud = await prisma.request.findUnique({
      where: { id: params.solicitudId },
      include: { actor: { select: { id: true, name: true, address: true, city: true, lat: true, lng: true } } },
    });

    if (!solicitud) return jsonError(404, "Solicitud no encontrada");
    if (solicitud.status !== "open") return jsonError(400, "La solicitud ya está siendo procesada");

    const supplyWhere: any = {
      status: "available",
      quantity: { gt: 0 },
      name: { contains: solicitud.name, mode: "insensitive" },
      unit: { equals: solicitud.unit, mode: "insensitive" },
    };
    if (auth.actorType === "warehouse") {
      supplyWhere.actorId = auth.actorId;
    } else {
      supplyWhere.actorId = { not: solicitud.actorId };
    }
    const supplies = await prisma.supply.findMany({
      where: supplyWhere,
      include: { actor: { select: { id: true, name: true, address: true, whatsapp: true, city: true, lat: true, lng: true } } },
    });

    const matches = supplies.map((s) => ({
      almacenId: s.actorId,
      almacenNombre: s.actor.name,
      almacenDireccion: s.actor.address,
      almacenTelefono: s.actor.whatsapp,
      supplyId: s.id,
      insumo: s.name,
      cantidadDisponible: s.quantity,
      cantidadRequerida: solicitud.quantity,
      unidad: s.unit,
      distancia: distancia(s.actor.lat || 0, s.actor.lng || 0, solicitud.actor.lat || 0, solicitud.actor.lng || 0),
      reliefActorId: solicitud.actorId,
    }));

    await publishEvent("matching.realizado", { requestId: params.solicitudId, matchesCount: matches.length });

    if (matches.length === 0) {
      return Response.json({ mensaje: "No se encontraron matches para esta solicitud", matches: [] });
    }

    return Response.json({ solicitud, matches });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
