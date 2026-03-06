import type { Metadata } from "next";
import { Titillium_Web } from "next/font/google";
import { SWRProvider } from "@/lib/swr-config";
import { Navbar } from "@/components/layout/navbar";
import "./globals.css";

const titillium = Titillium_Web({
  variable: "--font-titillium",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export const metadata: Metadata = {
  title: "F1 Dashboard",
  description: "Formula 1 data dashboard powered by OpenF1",
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
        </SWRProvider>
      </body>
    </html>
  );
}
