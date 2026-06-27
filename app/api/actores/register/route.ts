import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";

export async function POST(req: NextRequest) {
  try {
    const { type, name, contactName, phone, whatsapp, address, city, email, password, vehicleType, capacityKg, lat, lng } = await req.json();

    const cleanWhatsapp = whatsapp ? whatsapp.replace(/\D/g, "") : Date.now().toString();
    const finalEmail = email || `wa_${cleanWhatsapp}@disaster.acopio`;
    const existing = await prisma.user.findUnique({ where: { email: finalEmail } });
    if (existing) return jsonError(400, "El email o whatsapp ya está registrado");

    const pwd = password || `password_${cleanWhatsapp}`;
    const hashed = await hashPassword(pwd);

    const user = await prisma.user.create({
      data: { name, email: finalEmail },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: "email",
        accountId: email,
        password: hashed,
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
        actor: { id: actor.id, type: actor.type, name: actor.name, email: user.email },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
