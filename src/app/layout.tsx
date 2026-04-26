import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Scientist — Fulcrum × MIT Hackathon",
  description:
    "Turn a natural-language hypothesis into a fully grounded experiment plan with literature QC, RAG evidence retrieval, and structured protocol, budget, and timeline — powered by Gemini.",
  keywords: ["AI", "science", "experiment planning", "RAG", "Gemini", "MIT", "Fulcrum"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
