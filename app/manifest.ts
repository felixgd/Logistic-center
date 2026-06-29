import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Logística en Crisis",
    short_name: "Logística",
    description: "Sistema centralizado de logística para centros de acopio post-desastres",
    start_url: "/",
    display: "standalone",
    background_color: "#0D0D0D",
    theme_color: "#10b981",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
