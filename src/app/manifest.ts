import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ClinicSoft Agent",
    short_name: "ClinicSoft",
    description:
      "Ask your ClinicSoft 9.0 clinic database anything in plain English, under your own permissions.",
    start_url: "/ask",
    display: "standalone",
    background_color: "#0a0d15",
    theme_color: "#4f5df2",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
