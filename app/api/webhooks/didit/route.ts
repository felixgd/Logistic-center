import { NextRequest } from "next/server";
import { verifyDiditWebhookSignature, processDiditWebhook } from "@/lib/didit";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const signature = req.headers.get("x-signature");
  const signatureV2 = req.headers.get("x-signature-v2");
  const signatureSimple = req.headers.get("x-signature-simple");
  const timestamp = req.headers.get("x-timestamp");

  const { valid, method } = verifyDiditWebhookSignature(
    rawBody,
    signature,
    signatureV2,
    signatureSimple,
    timestamp,
  );

  if (!valid) {
    console.error(`Didit webhook signature verification failed (method=${method})`);
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody);
    await processDiditWebhook(body);
  } catch (error) {
    console.error("Didit webhook processing error:", error);
  }

  return Response.json({ ok: true });
}
