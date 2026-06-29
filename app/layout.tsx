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
  appleWebApp: {
    capable: true,
    title: "Logística",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={dmSans.variable}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#10b981" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            const theme = localStorage.getItem('theme') || 
              (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.setAttribute('data-theme', theme);
          })()
        ` }} />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                console.log('ServiceWorker registration successful with scope: ', reg.scope);
              }, function(err) {
                console.log('ServiceWorker registration failed: ', err);
              });
            });
          }
        ` }} />
      </head>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
