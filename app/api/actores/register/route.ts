import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";

export async function POST(req: NextRequest) {
  try {
    const { type, name, contactName, phone, whatsapp, address, city, email, vehicleType, capacityKg, lat, lng, phoneVerificationToken } = await req.json();

    const targetPhone = (whatsapp || phone || "").replace(/\D/g, "");
    if (targetPhone.length < 10) return jsonError(400, "Teléfono / WhatsApp inválido");

    if (!phoneVerificationToken) return jsonError(400, "Debes verificar tu teléfono antes de registrarte");

    const verif = await prisma.phone_verification.findFirst({
      where: { phone: targetPhone, token: phoneVerificationToken, verified: true },
    });
    if (!verif) return jsonError(400, "Teléfono no verificado. Solicita un nuevo código.");

    const finalEmail = email || `wa_${targetPhone}@disaster.acopio`;
    const existing = await prisma.user.findUnique({ where: { email: finalEmail } });
    if (existing) return jsonError(400, "El email o whatsapp ya está registrado");

    const user = await prisma.user.create({
      data: { name, phone: targetPhone, phoneVerified: true, email: finalEmail },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: "email",
        accountId: finalEmail || targetPhone,
      },
    });

    const actor = await prisma.actor.create({
      data: {
        userId: user.id,
        type,
        name,
        contactName: contactName || name,
        phone: phone || whatsapp,
        whatsapp: whatsapp || phone,
        address,
        city: city || "",
        lat: lat || null,
        lng: lng || null,
        vehicleType: type === "transportista" ? vehicleType : null,
        capacityKg: type === "transportista" ? capacityKg : null,
      },
    });

    await publishEvent("actor.registrado", {
      userId: user.id,
      actorId: actor.id,
      type: actor.type,
      name: actor.name,
      whatsapp: actor.whatsapp,
    });

    const token = signToken({ userId: user.id, actorId: actor.id, actorType: actor.type });

    return Response.json(
      {
        mensaje: "Registro exitoso",
        token,
        actor: { id: actor.id, type: actor.type, name: actor.name, email: user.email, isOwner: true },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
