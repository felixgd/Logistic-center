import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/auth";
import { sendSms } from "@/lib/zavu";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone) return jsonError(400, "Teléfono requerido");

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) return jsonError(400, "Teléfono inválido. Debe tener al menos 10 dígitos.");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.phone_verification.create({
      data: { phone: cleanPhone, code, expiresAt },
    });

    const smsResult = await sendSms(
      cleanPhone,
      `Tu código de verificación es: ${code}. Válido por 10 minutos.`,
      "auto"
    );

    if (!smsResult.success) {
      return jsonError(500, `No se pudo enviar el código: ${smsResult.error || "Error desconocido"}`);
    }

    return Response.json({ mensaje: "Código enviado", expiresIn: 600 });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
