import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, jsonError } from "@/lib/auth";
import { publishEvent } from "@/lib/pubsub";
import { sanitizeText } from "@/lib/validation";
import { generateCsrfToken } from "@/lib/csrf";
import { isValidPhoneNumber } from "libphonenumber-js";
import { createDiditSession } from "@/lib/didit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = sanitizeText(body.type);
    const name = sanitizeText(body.name);
    const contactName = sanitizeText(body.contactName || body.name);
    const phone = sanitizeText(body.phone);
    const whatsapp = sanitizeText(body.whatsapp);
    const address = sanitizeText(body.address);
    const city = sanitizeText(body.city);
    const email = sanitizeText(body.email);
    const vehicleType = sanitizeText(body.vehicleType);
    const capacityKg = body.capacityKg ? Number(body.capacityKg) : null;
    const lat = body.lat ? Number(body.lat) : null;
    const lng = body.lng ? Number(body.lng) : null;
    const phoneVerificationToken = sanitizeText(body.phoneVerificationToken);
    const documentNumber = body.documentNumber || null;

    const targetPhone = (whatsapp || phone || "").replace(/\D/g, "");
    if (targetPhone.length < 7 || !isValidPhoneNumber(`+${targetPhone}`)) return jsonError(400, "Teléfono / WhatsApp inválido");

    const blockedActor = await prisma.actor.findFirst({ where: { whatsapp: targetPhone, kycBlocked: true } });
    if (blockedActor) {
      return jsonError(403, "No puedes registrarte con este número. La cuenta asociada fue bloqueada por exceder intentos de verificación.");
    }

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
        documentNumber,
        diditStatus: type === "transportista" ? "pending" : "not_started",
      },
    });

    await publishEvent("actor.registrado", {
      userId: user.id,
      actorId: actor.id,
      type: actor.type,
      name: actor.name,
      whatsapp: actor.whatsapp,
    });

    // Create Didit session for transporters (skip if mocked)
    const isKycMocked = process.env.IS_KYC_MOCKED === "true";
    let verificationUrl: string | undefined;
    if (actor.type === "transportista" && actor.diditStatus !== "approved") {
      if (isKycMocked) {
        await prisma.actor.update({
          where: { id: actor.id },
          data: { diditStatus: "approved" },
        });
        actor.diditStatus = "approved";
      } else {
        try {
          const session = await createDiditSession(actor.id, user.email || undefined);
          verificationUrl = session.url;
          await prisma.actor.update({
            where: { id: actor.id },
            data: { diditSessionId: session.session_id, diditStatus: "pending" },
          });
        } catch (err) {
          console.error("Error creating Didit session:", err);
        }
      }
    }

    let token: string | null = null;
    let csrfToken: string | undefined;
    if (!(actor.type === "transportista" && actor.diditStatus !== "approved")) {
      csrfToken = generateCsrfToken();
      token = signToken({ userId: user.id, actorId: actor.id, actorType: actor.type, csrfToken, diditStatus: actor.diditStatus, kycBlocked: actor.kycBlocked });
    }

    return Response.json(
      {
        mensaje: "Registro exitoso",
        ...(token ? { token, csrfToken } : {}),
        actor: { id: actor.id, type: actor.type, name: actor.name, email: user.email, isOwner: true },
        ...(verificationUrl ? { verificationUrl } : {}),
      },
      { status: 201 }
    );
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
