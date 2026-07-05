import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const affiliateCode = await prisma.affiliate_code.findUnique({
      where: { code: params.code },
      include: { actor: { select: { name: true, type: true, address: true, city: true } } },
    });

    if (!affiliateCode || !affiliateCode.active) return jsonError(404, "Código inválido o expirado");
    if (affiliateCode.usedAt) return jsonError(400, "Código ya utilizado");

    return Response.json({
      actorName: affiliateCode.actor.name,
      actorType: affiliateCode.actor.type,
      address: affiliateCode.actor.address,
      city: affiliateCode.actor.city,
    });
  } catch (error: any) {
    console.error("Affiliate code info API error:", error);
    return jsonError(500, "An internal server error occurred.");
  }
}
