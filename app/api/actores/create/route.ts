import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, signToken, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";
import { sanitizeText } from "@/lib/validation";
import { generateCsrfToken } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    const body = await req.json();
    const type = sanitizeText(body.type);
    const name = sanitizeText(body.name);
    const contactName = sanitizeText(body.contactName || body.name);
    const phone = sanitizeText(body.phone);
    const whatsapp = sanitizeText(body.whatsapp);
    const address = sanitizeText(body.address);
    const city = sanitizeText(body.city);
    const lat = body.lat ? Number(body.lat) : null;
    const lng = body.lng ? Number(body.lng) : null;
    const vehicleType = sanitizeText(body.vehicleType);
    const capacityKg = body.capacityKg ? Number(body.capacityKg) : null;

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
    const csrfToken = generateCsrfToken();
    const token = signToken({ userId: auth.userId, actorId: actor.id, actorType: actor.type, csrfToken, diditStatus: actor.diditStatus, kycBlocked: actor.kycBlocked });

    return Response.json({
      mensaje: "Perfil creado exitosamente",
      token,
      csrfToken,
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
