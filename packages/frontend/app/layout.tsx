import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RayVerify™ Investigator Dashboard",
    template: "%s — RayVerify™",
  },
  description:
    "Government-grade Medicaid fraud detection & identity verification. Investigator dashboard for OIG agents, auditors, and compliance officers.",
  robots: { index: false, follow: false }, // Never publicly index gov security tools
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head />
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
