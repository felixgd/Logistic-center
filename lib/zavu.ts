import Zavudev from "@zavudev/sdk";

let client: Zavudev | null = null;

export function getZavuApiKey(): string | undefined {
  return process.env.ZAVUDEV_API_KEY || process.env.ZAVU_API_KEY || undefined;
}

function getClient(): Zavudev {
  if (!client) {
    const apiKey = getZavuApiKey();
    client = new Zavudev({ apiKey });
  }
  return client;
}

export async function sendSms(
  to: string,
  text: string,
  channel: "sms" | "whatsapp" | "auto" = "auto"
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = getZavuApiKey();
  if (!apiKey) {
    console.warn("[Zavu] ZAVUDEV_API_KEY no configurada. Mensaje simulado:", { to, text });
    return { success: true };
  }

  const normalizedTo = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;

  try {
    const result = await getClient().messages.send({
      to: normalizedTo,
      text,
      channel,
    });
    return { success: true, messageId: result.message?.id };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error("Error enviando mensaje con Zavu:", message, error);
    return { success: false, error: message };
  }
}
