import type { Metadata } from "next";
import "@/styles/global.css";
import ToastProvider from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "Logística",
  description: "Sistema centralizado de logística para centros de acopio post-desastres",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
