import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, jsonError } from "@/lib/auth";
import { sanitizeText } from "@/lib/validation";
import { generateCsrfToken } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = sanitizeText(body.code);
    const name = sanitizeText(body.name);
    const phone = sanitizeText(body.phone);
    const email = sanitizeText(body.email);
    const phoneVerificationToken = sanitizeText(body.phoneVerificationToken);

    const cleanPhone = phone.replace(/\D/g, "");
    if (phoneVerificationToken) {
      const verif = await prisma.phone_verification.findFirst({
        where: { phone: cleanPhone, token: phoneVerificationToken, verified: true },
      });
      if (!verif) return jsonError(400, "Teléfono no verificado");
    }

    const affiliateCode = await prisma.affiliate_code.findUnique({ where: { code } });
    if (!affiliateCode || !affiliateCode.active) return jsonError(400, "Código inválido o expirado");
    if (affiliateCode.usedAt) return jsonError(400, "Código ya utilizado");

    const existingPhone = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    if (existingPhone) return jsonError(400, "El teléfono ya está registrado");
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) return jsonError(400, "El email ya está registrado");
    }

    const parentActor = await prisma.actor.findUnique({ where: { id: affiliateCode.actorId } });
    if (!parentActor) return jsonError(404, "Cuenta principal no encontrada");

    const user = await prisma.user.create({
      data: { name, phone: cleanPhone, phoneVerified: true, email: email || null },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: "email",
        accountId: email || cleanPhone,
      },
    });

    await prisma.actor_user.create({
      data: {
        actorId: parentActor.id,
        userId: user.id,
        role: "member",
        phone,
      },
    });

    await prisma.affiliate_code.update({
      where: { id: affiliateCode.id },
      data: { active: false, usedAt: new Date(), usedByUserId: user.id },
    });

    const csrfToken = generateCsrfToken();
    const token = signToken({ userId: user.id, actorId: parentActor.id, actorType: parentActor.type, csrfToken });

    return Response.json({
      mensaje: "Registro exitoso como afiliado",
      token,
      csrfToken,
      actor: {
        id: parentActor.id,
        type: parentActor.type,
        name: parentActor.name,
        email: user.email,
        isOwner: false,
      },
    }, { status: 201 });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
