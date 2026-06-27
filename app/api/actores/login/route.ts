import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken, jsonError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return jsonError(401, "Credenciales inválidas");

    const account = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "email" },
    });
    if (!account?.password || !(await comparePassword(password, account.password)))
      return jsonError(401, "Credenciales inválidas");

    const actor = await prisma.actor.findFirst({ where: { userId: user.id } });
    if (!actor) return jsonError(401, "Cuenta sin perfil de actor");

    const token = signToken({ userId: user.id, actorId: actor.id, actorType: actor.type });

    return Response.json({
      token,
      actor: {
        id: actor.id,
        type: actor.type,
        name: actor.name,
        email: user.email,
        whatsapp: actor.whatsapp,
        phone: actor.phone,
      },
    });
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
