import { prisma } from "./prisma";
import { sendWhatsAppMessage } from "./whatsapp";

let natsConn: any = null;

async function getConnection(): Promise<any> {
  const url = process.env.NATS_URL;
  if (!url) return null;
  if (natsConn && !natsConn.isClosed()) return natsConn;
  try {
    const { connect, StringCodec } = await import("nats");
    natsConn = await connect({ servers: url });
    console.log("Conectado a NATS:", url);
    return natsConn;
  } catch (error) {
    console.error("Error conectando a NATS:", error);
    return null;
  }
}

export async function publishEvent(eventType: string, data: any): Promise<void> {
  const payload = { eventType, data, timestamp: new Date().toISOString() };

  try {
    await prisma.event_log.create({
      data: {
        eventType,
        userId: data.userId || null,
        actorId: data.actorId || null,
        shipmentId: data.shipmentId || null,
        channel: "system",
        payload: JSON.stringify(data),
      },
    });
  } catch { /* event_log is optional */ }

  const conn = await getConnection();
  if (conn) {
    try {
      const { StringCodec } = await import("nats");
      const sc = StringCodec();
      conn.publish(`logistica.${eventType}`, sc.encode(JSON.stringify(payload)));
    } catch (error) {
      console.error("Error publicando en NATS:", error);
    }
  }

  console.log("[Evento]", eventType, JSON.stringify(data));
}
