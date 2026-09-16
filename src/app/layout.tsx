import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Suraksha Setu — Verified Hyperlocal Weather & Disaster Intelligence",
  description:
    "A calm, verified hyperlocal weather and disaster-alert platform for India. Combining citizen ground reports with Doppler radar and human-in-the-loop verification for safer local decisions.",
  keywords: [
    "Suraksha Setu",
    "Suraksha Setu India",
    "सुरक्षा सेतु",
    "weather intelligence",
    "disaster alert",
    "monsoon warning",
    "urban flooding",
    "India",
    "hyperlocal weather",
    "IMD",
    "NDMA",
  ],
  authors: [{ name: "Suraksha Setu Platform" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/logo-sm.png", type: "image/png" },
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/icon-192.png" }],
  },
  openGraph: {
    title: "Suraksha Setu — Weather clarity. When every minute matters.",
    description: "Verified citizen reports and live weather intelligence for safer local decisions.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0B1F33",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
