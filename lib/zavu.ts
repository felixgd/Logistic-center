import Zavudev from "@zavudev/sdk";

let client: Zavudev | null = null;

function getClient(): Zavudev {
  if (!client) {
    client = new Zavudev({ apiKey: process.env.ZAVU_API_KEY || "" });
  }
  return client;
}

export async function sendSms(to: string, text: string): Promise<{ success: boolean; messageId?: string }> {
  if (!process.env.ZAVU_API_KEY) {
    console.log("[Zavu Simulado] Para:", to, "Mensaje:", text);
    return { success: true };
  }
  try {
    const result = await getClient().messages.send({ to, text, channel: "sms" });
    return { success: true, messageId: result.message?.id };
  } catch (error: any) {
    console.error("Error enviando SMS con Zavu:", error.message);
    return { success: false };
  }
}
