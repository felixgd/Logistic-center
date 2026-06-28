import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "@/styles/global.css";
import ToastProvider from "@/components/ToastProvider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Logística",
  description: "Sistema centralizado de logística para centros de acopio post-desastres",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={dmSans.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            const theme = localStorage.getItem('theme') || 
              (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.setAttribute('data-theme', theme);
          })()
        ` }} />
      </head>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
