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

export async function PUT(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const body = await req.json();
    const { name, contactName, phone, whatsapp, address, city, vehicleType, capacityKg } = body;

    const actor = await prisma.actor.findUnique({
      where: { id: auth.actorId },
    });
    if (!actor) return jsonError(404, "Actor no encontrado");

    if (actor.userId !== auth.userId) {
      return jsonError(403, "No tienes permiso para editar este perfil");
    }

    const updated = await prisma.actor.update({
      where: { id: auth.actorId },
      data: {
        name: name !== undefined ? name : undefined,
        contactName: contactName !== undefined ? contactName : undefined,
        phone: phone !== undefined ? phone : undefined,
        whatsapp: whatsapp !== undefined ? whatsapp : undefined,
        address: address !== undefined ? address : undefined,
        city: city !== undefined ? city : undefined,
        vehicleType: vehicleType !== undefined ? vehicleType : undefined,
        capacityKg: capacityKg !== undefined ? (capacityKg ? Number(capacityKg) : null) : undefined,
      },
    });

    return Response.json({
      success: true,
      actor: {
        id: updated.id,
        type: updated.type,
        name: updated.name,
        whatsapp: updated.whatsapp,
        phone: updated.phone,
        vehicleType: updated.vehicleType,
        capacityKg: updated.capacityKg,
      }
    });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
