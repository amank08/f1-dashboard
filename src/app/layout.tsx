import type { Metadata, Viewport } from "next";
import { Titillium_Web } from "next/font/google";
import { SWRProvider } from "@/lib/swr-config";
import { Navbar } from "@/components/layout/navbar";
import { PWARegister } from "@/components/pwa-register";
import "./globals.css";

const titillium = Titillium_Web({
  variable: "--font-titillium",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Undercut",
  description: "Formula 1 race data, lap times, pit strategies, and live timing",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Undercut",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#15151E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${titillium.variable} antialiased`}>
        <SWRProvider>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
          <PWARegister />
        </SWRProvider>
      </body>
    </html>
  );
}
