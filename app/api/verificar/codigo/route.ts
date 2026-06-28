import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();
    if (!phone || !code) return jsonError(400, "Teléfono y código requeridos");

    const cleanPhone = phone.replace(/\D/g, "");

    const record = await prisma.phone_verification.findFirst({
      where: {
        phone: cleanPhone,
        code,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) return jsonError(400, "Código inválido o expirado");

    const token = crypto.randomBytes(32).toString("hex");

    await prisma.$transaction([
      prisma.phone_verification.update({
        where: { id: record.id },
        data: { verified: true, token },
      }),
      prisma.user.updateMany({
        where: { phone: cleanPhone },
        data: { phoneVerified: true },
      }),
    ]);

    return Response.json({ mensaje: "Teléfono verificado", token });
  } catch (error: any) {
    console.error("Verification code check API error:", error);
    return jsonError(500, "An internal server error occurred.");
  }
}
