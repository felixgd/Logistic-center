import { sendSms } from "@/lib/zavu";

export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

export async function notifyBySms(phone: string | null | undefined, message: string): Promise<void> {
  const clean = normalizePhone(phone);
  if (!clean) return;
  try {
    const result = await sendSms(clean, message, "auto");
    if (!result.success) {
      console.warn(`[SMS] Fallo al notificar a ${clean}:`, result.error);
    }
  } catch (error) {
    console.error(`[SMS] Error notificando a ${clean}:`, error);
  }
}

export function formatTripCode(shipment: { notes?: string | null; id: string }): string {
  return shipment.notes?.startsWith("VIA-") ? shipment.notes.split(" ")[0] : shipment.id.slice(-8).toUpperCase();
}

export function formatItems(items: { quantity: number; unit?: string | null; name: string }[]): string {
  return items.map((i) => `${i.quantity} ${i.unit || "unidad"} de ${i.name}`).join(", ");
}
