import type { Metadata } from "next";
import "@/styles/global.css";

export const metadata: Metadata = {
  title: "Logística",
  description: "Sistema centralizado de logística para centros de acopio post-desastres",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
