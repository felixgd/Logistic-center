import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, jsonError } from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";
import { createDiditSession } from "@/lib/didit";

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

    const isKycMocked = process.env.IS_KYC_MOCKED === "true";
    if (!isKycMocked) {
      const userActors = await prisma.actor.findMany({ where: { userId: user.id }, include: { user: true } });
      const transporterActors = userActors.filter((a) => a.type === "transporter" || a.type === "transportista");
      const blockedTransporter = transporterActors.find((a) => a.kycBlocked);
      if (blockedTransporter) {
        return jsonError(403, "Cuenta bloqueada por exceder intentos de verificación de identidad. Contacta a soporte.");
      }
      const pendingTransporter = transporterActors.find((a) => a.diditStatus !== "approved");
      if (pendingTransporter) {
        let verificationUrl: string | undefined;
        try {
          const session = await createDiditSession(pendingTransporter.id, pendingTransporter.user?.email || undefined);
          verificationUrl = session.url;
          await prisma.actor.update({
            where: { id: pendingTransporter.id },
            data: { diditSessionId: session.session_id, diditStatus: "pending" },
          });
        } catch {
          // fallback: return error without verificationUrl
        }
        return Response.json(
          {
            error: "Debes completar la verificación de identidad (KYC) antes de usar la plataforma.",
            code: "KYC_PENDING",
            ...(verificationUrl ? { verificationUrl } : {}),
          },
          { status: 403 }
        );
      }
    }

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
    const token = signToken({ userId: user.id, actorId: actor.id, actorType: actor.type, csrfToken, diditStatus: actor.diditStatus, kycBlocked: actor.kycBlocked });

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
