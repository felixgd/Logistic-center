export function getZavuApiKey(): string | undefined {
  return process.env.ZAVUDEV_API_KEY || process.env.ZAVU_API_KEY || undefined;
}

function normalizePhoneNumber(to: string): string {
  const digits = to.replace(/\D/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
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

  const normalizedTo = normalizePhoneNumber(to);
  const baseURL = process.env.ZAVUDEV_BASE_URL || "https://api.zavu.dev";
  const url = `${baseURL.replace(/\/$/, "")}/v1/messages`;

  // SMS estándar: limitar a 160 caracteres para evitar errores de longitud
  const maxLength = channel === "whatsapp" ? 1500 : 160;
  const safeText = text.slice(0, maxLength);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: normalizedTo,
        text: safeText,
        channel,
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();

    if (!response.ok || !contentType.includes("application/json")) {
      console.error(`[Zavu] Error HTTP ${response.status} enviando SMS a ${normalizedTo}. Respuesta:`, rawBody.slice(0, 500));
      return { success: false, error: `HTTP ${response.status}: ${rawBody.slice(0, 200)}` };
    }

    const result = JSON.parse(rawBody);
    return { success: true, messageId: result.message?.id || result.id };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error("[Zavu] Error enviando mensaje:", message, error);
    return { success: false, error: message };
  }
}
