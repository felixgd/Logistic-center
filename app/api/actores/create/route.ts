import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, signToken, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";

export async function POST(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const { type, name, contactName, phone, whatsapp, address, city, lat, lng, vehicleType, capacityKg } = await req.json();

    if (!type || !name) {
      return jsonError(400, "Tipo de actor y nombre son requeridos");
    }

    const validTypes = ["warehouse", "relief", "transporter"];
    if (!validTypes.includes(type)) {
      return jsonError(400, "Tipo de actor inválido");
    }

    // Create the actor profile linked to the current user
    const actor = await prisma.actor.create({
      data: {
        userId: auth.userId,
        type,
        name,
        contactName: contactName || name,
        phone: phone || null,
        whatsapp: whatsapp || null,
        address: address || null,
        city: city || "",
        lat: lat || null,
        lng: lng || null,
        vehicleType: type === "transporter" ? vehicleType : null,
        capacityKg: type === "transporter" ? (capacityKg ? Number(capacityKg) : null) : null,
      },
    });

    await publishEvent("actor.registrado", {
      userId: auth.userId,
      actorId: actor.id,
      type: actor.type,
      name: actor.name,
      whatsapp: actor.whatsapp,
    });

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });

    // Switch context automatically to the newly created actor
    const token = signToken({ userId: auth.userId, actorId: actor.id, actorType: actor.type });

    return Response.json({
      mensaje: "Perfil creado exitosamente",
      token,
      actor: {
        id: actor.id,
        type: actor.type,
        name: actor.name,
        email: user?.email,
        whatsapp: actor.whatsapp,
        phone: actor.phone,
        isOwner: true,
      },
    }, { status: 201 });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
