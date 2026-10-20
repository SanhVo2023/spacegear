import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://platform-clone-gilt.vercel.app"),
  title: "Platform® — Modular Landing Page",
  description:
    "The smarter way to build, run, and scale your business. You innovate, we automate.",
  openGraph: {
    title: "Platform® — The smarter way to build, run, and scale",
    description:
      "We run your infrastructure so you can focus on building great products.",
    images: [{ url: "/seo/og.jpg", width: 1200, height: 670 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Platform® — The smarter way to build, run, and scale",
    description:
      "We run your infrastructure so you can focus on building great products.",
    images: ["/seo/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
