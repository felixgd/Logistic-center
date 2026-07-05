import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthActor, signToken, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";
import { sanitizeText } from "@/lib/validation";
import { generateCsrfToken } from "@/lib/csrf";
import { createDiditSession } from "@/lib/didit";

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
    const documentNumber = body.documentNumber || null;

    const missing: string[] = [];
    if (!type) missing.push("tipo de actor");
    if (!name) missing.push("nombre");
    if (missing.length > 0) {
      return jsonError(400, `Campos requeridos faltantes: ${missing.join(", ")}.`);
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
        documentNumber: type === "transporter" ? documentNumber : null,
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

    // Create Didit session for transporters
    const isKycMocked = process.env.IS_KYC_MOCKED === "true";
    let verificationUrl: string | undefined;
    if (actor.type === "transporter" && !isKycMocked) {
      try {
        const session = await createDiditSession(actor.id, user?.email || undefined);
        verificationUrl = session.url;
        await prisma.actor.update({
          where: { id: actor.id },
          data: { diditSessionId: session.session_id, diditStatus: "pending" },
        });
        actor.diditStatus = "pending";
      } catch (err) {
        console.error("Error creating Didit session:", err);
      }
    }

    // Sign token (skip for transporters with pending KYC)
    let token: string | null = null;
    let csrfToken: string | undefined;
    if (!(actor.type === "transporter" && actor.diditStatus !== "approved")) {
      csrfToken = generateCsrfToken();
      token = signToken({ userId: auth.userId, actorId: actor.id, actorType: actor.type, csrfToken, diditStatus: actor.diditStatus, kycBlocked: actor.kycBlocked });
    }

    return Response.json({
      mensaje: "Perfil creado exitosamente",
      ...(token ? { token, csrfToken } : {}),
      actor: {
        id: actor.id,
        type: actor.type,
        name: actor.name,
        email: user?.email,
        whatsapp: actor.whatsapp,
        phone: actor.phone,
        isOwner: true,
      },
      ...(verificationUrl ? { verificationUrl } : {}),
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(400, "El perfil del actor ya existe.");
    }
    console.error("Actors creation API error:", error);
    return jsonError(500, "An internal server error occurred.");
  }
}
