import axios from "axios";

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

export async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.log("[WhatsApp Simulado] Para:", to, "Mensaje:", message);
    return;
  }

  try {
    await axios.post(
      `${WHATSAPP_API_URL}/${phoneId}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error enviando WhatsApp:", error.response?.data || error.message);
  }
}
