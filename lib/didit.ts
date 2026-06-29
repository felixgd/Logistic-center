import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const DIDIT_API_KEY = process.env.DIDIT_API_KEY || "";
const DIDIT_WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID || "";
const DIDIT_WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const DIDIT_AUTH_API = "https://apx.didit.me/auth/v2";
const DIDIT_VERIFICATION_API = "https://verification.didit.me/v3";

export interface DiditSessionResult {
  session_id: string;
  session_token: string;
  url: string;
  status: string;
}

export async function createDiditSession(
  vendorData: string,
  userEmail?: string,
  userPhone?: string,
): Promise<DiditSessionResult> {
  if (!DIDIT_API_KEY) throw new Error("DIDIT_API_KEY no configurado");
  if (!DIDIT_WORKFLOW_ID) throw new Error("DIDIT_WORKFLOW_ID no configurado");

  const body: Record<string, unknown> = {
    workflow_id: DIDIT_WORKFLOW_ID,
    vendor_data: vendorData,
    callback: `${APP_URL}/verificacion/completado`,
    callback_method: "both",
  };

  if (userEmail || userPhone) {
    body.contact_details = {
      ...(userEmail ? { email: userEmail, send_notification_emails: false } : {}),
      ...(userPhone ? { phone: userPhone } : {}),
    };
  }

  const res = await fetch(`${DIDIT_VERIFICATION_API}/session/`, {
    method: "POST",
    headers: { "x-api-key": DIDIT_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Error al crear sesión Didit: ${error}`);
  }

  const data = await res.json();
  return {
    session_id: data.session_id,
    session_token: data.session_token,
    url: data.url,
    status: data.status,
  };
}

export async function getDiditDecision(sessionId: string): Promise<any> {
  if (!DIDIT_API_KEY) throw new Error("DIDIT_API_KEY no configurado");

  const res = await fetch(`${DIDIT_VERIFICATION_API}/session/${sessionId}/decision/`, {
    headers: { "x-api-key": DIDIT_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Error al obtener decisión Didit: ${await res.text()}`);
  }

  return res.json();
}

export function verifyDiditWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  signatureV2Header: string | null,
  signatureSimpleHeader: string | null,
  timestampHeader: string | null,
): { valid: boolean; method: string } {
  if (!DIDIT_WEBHOOK_SECRET) return { valid: false, method: "missing_secret" };
  if (!timestampHeader) return { valid: false, method: "missing_timestamp" };

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestampHeader, 10)) > 300) {
    return { valid: false, method: "expired" };
  }

  if (signatureV2Header) {
    try {
      const body = JSON.parse(rawBody);
      const canonical = JSON.stringify(sortKeys(shortenFloats(body)));
      const expected = crypto.createHmac("sha256", DIDIT_WEBHOOK_SECRET).update(canonical, "utf8").digest("hex");
      if (timingSafeEqual(expected, signatureV2Header)) {
        return { valid: true, method: "v2" };
      }
    } catch { /* fall through */ }
  }

  if (signatureHeader) {
    const expected = crypto.createHmac("sha256", DIDIT_WEBHOOK_SECRET).update(rawBody, "utf8").digest("hex");
    if (timingSafeEqual(expected, signatureHeader)) {
      return { valid: true, method: "v1" };
    }
  }

  if (signatureSimpleHeader) {
    try {
      const body = JSON.parse(rawBody);
      const canonical = [body.timestamp ?? "", body.session_id ?? "", body.status ?? "", body.webhook_type ?? ""].join(":");
      const expected = crypto.createHmac("sha256", DIDIT_WEBHOOK_SECRET).update(canonical, "utf8").digest("hex");
      if (timingSafeEqual(expected, signatureSimpleHeader)) {
        return { valid: true, method: "simple" };
      }
    } catch { /* fall through */ }
  }

  return { valid: false, method: "no_match" };
}

export async function processDiditWebhook(body: any) {
  const { webhook_type, status, session_id, vendor_data, decision } = body;

  if (webhook_type !== "status.updated") return;
  if (!session_id || !vendor_data) return;

  const diditStatus = mapDiditStatus(status);
  if (!diditStatus) return;

  const actor = await prisma.actor.findUnique({ where: { id: vendor_data } });
  if (!actor) return;

  const updateData: Record<string, unknown> = { diditStatus, diditSessionId: session_id };

  if (status === "Approved" && decision) {
    const idVerification = decision.id_verifications?.[0];
    const diditDocumentNumber = idVerification?.document_number;

    if (actor.documentNumber && diditDocumentNumber && actor.documentNumber !== diditDocumentNumber) {
      updateData.diditStatus = "document_mismatch";
      updateData.verified = false;
    } else {
      updateData.verified = true;
      if (diditDocumentNumber && !actor.documentNumber) {
        updateData.documentNumber = diditDocumentNumber;
      }
    }
  }

  if (status === "Declined" || status === "Expired" || status === "Kyc Expired" || status === "Abandoned") {
    updateData.verified = false;
  }

  const resolvedStatus = (updateData.diditStatus as string) || diditStatus;
  const TERMINAL_FAILURES = ["rejected", "expired", "abandoned", "document_mismatch"];
  if (TERMINAL_FAILURES.includes(resolvedStatus)) {
    const newAttempts = (actor.kycAttempts || 0) + 1;
    updateData.kycAttempts = newAttempts;
    if (newAttempts >= 2) {
      updateData.kycBlocked = true;
    }
  }

  await prisma.actor.update({ where: { id: vendor_data }, data: updateData });
}

function mapDiditStatus(s: string): string | null {
  switch (s) {
    case "Not Started": return "not_started";
    case "In Progress": return "pending";
    case "Approved": return "approved";
    case "Declined": return "rejected";
    case "In Review": return "in_review";
    case "Expired":
    case "Kyc Expired": return "expired";
    case "Abandoned": return "abandoned";
    case "Resubmitted": return "pending";
    case "Awaiting User": return "pending";
    default: return null;
  }
}

function shortenFloats(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(shortenFloats);
  if (data !== null && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, shortenFloats(v)]),
    );
  }
  if (typeof data === "number" && !Number.isInteger(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce((acc: Record<string, unknown>, key: string) => {
        acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return obj;
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
