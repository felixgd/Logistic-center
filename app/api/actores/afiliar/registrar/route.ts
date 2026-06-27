import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, jsonError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { code, name, phone, email, password } = await req.json();

    const affiliateCode = await prisma.affiliate_code.findUnique({ where: { code } });
    if (!affiliateCode || !affiliateCode.active) return jsonError(400, "Código inválido o expirado");
    if (affiliateCode.usedAt) return jsonError(400, "Código ya utilizado");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return jsonError(400, "El email ya está registrado");

    const parentActor = await prisma.actor.findUnique({ where: { id: affiliateCode.actorId } });
    if (!parentActor) return jsonError(404, "Cuenta principal no encontrada");

    const hashed = await hashPassword(password);

    const user = await prisma.user.create({
      data: { name, email },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: "email",
        accountId: email,
        password: hashed,
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

    const token = signToken({ userId: user.id, actorId: parentActor.id, actorType: parentActor.type });

    return Response.json({
      mensaje: "Registro exitoso como afiliado",
      token,
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
