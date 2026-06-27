import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  const actor = await prisma.actor.findUnique({
    where: { id: auth.actorId },
  });
  if (!actor) return jsonError(404, "Actor no encontrado");

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });

  return Response.json({
    id: actor.id,
    type: actor.type,
    name: actor.name,
    email: user?.email,
    contactName: actor.contactName,
    phone: actor.phone,
    whatsapp: actor.whatsapp,
    address: actor.address,
    city: actor.city,
    lat: actor.lat,
    lng: actor.lng,
    vehicleType: actor.vehicleType,
    capacityKg: actor.capacityKg,
    verified: actor.verified,
  });
}
