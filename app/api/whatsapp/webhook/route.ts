import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const verifyToken = "logistica_acopio_verify_123";
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Webhook WhatsApp verificado");
    return new Response(challenge, { status: 200 });
  }
  return new Response("Verification failed", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message) return Response.json({ status: "ok" });

    const from = message.from;
    const text = message.text?.body?.toUpperCase().trim();
    console.log(`WhatsApp de ${from}: ${text}`);

    if (text === "CONFIRMAR") {
      const actor = await prisma.actor.findFirst({ where: { whatsapp: from } });
      if (actor) {
        const shipment = await prisma.shipment.findFirst({
          where: { transporterActorId: actor.id, status: "assigned" },
        });
        if (shipment) {
          await prisma.shipment.update({ where: { id: shipment.id }, data: { status: "in_transit", updatedAt: new Date() } });
          console.log(`Envío ${shipment.id} confirmado`);
        }
      }
    } else if (text === "ENTREGADO") {
      const actor = await prisma.actor.findFirst({ where: { whatsapp: from } });
      if (actor) {
        const shipment = await prisma.shipment.findFirst({
          where: { transporterActorId: actor.id, status: "in_transit" },
        });
        if (shipment) {
          await prisma.shipment.update({ where: { id: shipment.id }, data: { status: "delivered", updatedAt: new Date() } });
          console.log(`Envío ${shipment.id} completado`);
        }
      }
    }

    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("Error en webhook WhatsApp:", error);
    return Response.json({ status: "ok" });
  }
}
