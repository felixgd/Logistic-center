import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";
import { sanitizeText } from "@/lib/validation";

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
    userPhone: user?.phone,
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
    const name = body.name !== undefined ? sanitizeText(body.name) : undefined;
    const contactName = body.contactName !== undefined ? sanitizeText(body.contactName) : undefined;
    const phone = body.phone !== undefined ? sanitizeText(body.phone) : undefined;
    const whatsapp = body.whatsapp !== undefined ? sanitizeText(body.whatsapp) : undefined;
    const address = body.address !== undefined ? sanitizeText(body.address) : undefined;
    const city = body.city !== undefined ? sanitizeText(body.city) : undefined;
    const vehicleType = body.vehicleType !== undefined ? sanitizeText(body.vehicleType) : undefined;
    const capacityKg = body.capacityKg !== undefined ? (body.capacityKg ? Number(body.capacityKg) : null) : undefined;
    const email = body.email !== undefined ? sanitizeText(body.email) : undefined;

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
        name,
        contactName,
        phone,
        whatsapp,
        address,
        city,
        vehicleType,
        capacityKg,
      },
    });

    // Update user email if provided
    if (email !== undefined) {
      await prisma.user.update({
        where: { id: auth.userId },
        data: { email: email || null },
      });
    }

    // Fetch fresh user to return email
    const freshUser = await prisma.user.findUnique({ where: { id: auth.userId } });

    return Response.json({
      success: true,
      actor: {
        id: updated.id,
        type: updated.type,
        name: updated.name,
        email: freshUser?.email || null,
        whatsapp: updated.whatsapp,
        phone: updated.phone,
        userPhone: freshUser?.phone || null,
        address: updated.address,
        city: updated.city,
        lat: updated.lat,
        lng: updated.lng,
        vehicleType: updated.vehicleType,
        capacityKg: updated.capacityKg,
      }
    });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(400, "El recurso ya existe o viola una restricción única.");
    }
    console.error("Actors profile update API error:", error);
    return jsonError(500, "An internal server error occurred.");
  }
}
