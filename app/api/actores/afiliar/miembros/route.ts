import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  const actor = await prisma.actor.findUnique({ where: { id: auth.actorId } });
  if (!actor) return jsonError(404, "Actor no encontrado");
  if (!["warehouse", "relief"].includes(actor.type)) return jsonError(403, "Solo almacenes y centros de ayuda pueden gestionar voluntarios");
  if (actor.userId !== auth.userId) return jsonError(403, "Solo el administrador principal puede gestionar voluntarios");

  const members = await prisma.actor_user.findMany({
    where: { actorId: auth.actorId, deletedAt: null },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { createdAt: "asc" },
  });

  interface MemberWithUser {
    id: string;
    userId: string;
    role: string;
    phone: string | null;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
    };
  }

  const mapped = (members as MemberWithUser[]).map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    phone: m.user.phone || m.phone,
    role: m.role,
    createdAt: m.createdAt,
  }));

  return Response.json(mapped);
}
