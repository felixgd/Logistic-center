import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, jsonError } from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();
    if (!phone || !code) return jsonError(400, "Teléfono y código requeridos");

    const cleanPhone = phone.replace(/\D/g, "");

    const user = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    if (!user) return jsonError(404, "No hay una cuenta registrada con este teléfono");

    const membership = await prisma.actor_user.findFirst({
      where: { userId: user.id, deletedAt: null },
      include: { actor: true },
    });

    const actor = membership?.actor || await prisma.actor.findFirst({ where: { userId: user.id } });
    if (!actor) return jsonError(404, "Cuenta sin perfil de actor");

    const isOwner = !membership;

    const verif = await prisma.phone_verification.findFirst({
      where: {
        phone: cleanPhone,
        code,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!verif) return jsonError(401, "Código inválido o expirado");

    await prisma.$transaction([
      prisma.phone_verification.update({
        where: { id: verif.id },
        data: { verified: true },
      }),
      prisma.user.updateMany({
        where: { phone: cleanPhone },
        data: { phoneVerified: true },
      }),
    ]);

    const csrfToken = generateCsrfToken();
    const token = signToken({ userId: user.id, actorId: actor.id, actorType: actor.type, csrfToken, diditStatus: actor.diditStatus });

    return Response.json({
      token,
      csrfToken,
      actor: {
        id: actor.id,
        type: actor.type,
        name: actor.name,
        email: user.email,
        whatsapp: actor.whatsapp,
        phone: actor.phone,
        isOwner,
      },
    });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
