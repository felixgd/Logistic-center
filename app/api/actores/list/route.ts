import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthActor, jsonError } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = getAuthActor(req);
  if (!auth) return jsonError(401, "Token requerido");

  try {
    // Get owned actors
    const owned = await prisma.actor.findMany({
      where: { userId: auth.userId },
    });

    // Get membership actors
    const memberships = await prisma.actor_user.findMany({
      where: { userId: auth.userId, deletedAt: null },
      include: { actor: true },
    });

    const memberActors = memberships.map((m: any) => m.actor);

    // Combine and deduplicate
    const allActors = [...owned];
    for (const actor of memberActors) {
      if (!allActors.some((a) => a.id === actor.id)) {
        allActors.push(actor);
      }
    }

    // Map to a clean response format
    const result = allActors.map((actor) => ({
      id: actor.id,
      type: actor.type,
      name: actor.name,
      isOwner: actor.userId === auth.userId,
    }));

    return Response.json(result);
  } catch (error: any) {
    return jsonError(500, error.message);
  }
}
