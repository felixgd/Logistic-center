import { put } from "@vercel/blob";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const allowed = ["jpg", "jpeg", "png", "pdf", "webp"];
    if (!allowed.includes(ext)) {
      return Response.json({ error: "Formato no permitido. Usa JPG, PNG o PDF." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: "El archivo no debe superar 5 MB" }, { status: 400 });
    }

    const uniqueName = `documentos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const blob = await put(uniqueName, file, { access: "private" });

    return Response.json({ url: blob.url });
  } catch (error: any) {
    console.error("Upload error:", error);
    return Response.json({ error: error.message || "Error al subir el archivo" }, { status: 500 });
  }
}
