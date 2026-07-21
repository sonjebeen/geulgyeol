import type { Metadata } from "next";
import { headers } from "next/headers";
import "@fontsource/gowun-dodum/korean-400.css";
import "@fontsource/jua/korean-400.css";
import "@fontsource/nanum-pen-script/korean-400.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "GeulGyeol · Korean Hangul Handwriting Coach",
    description: "Practice Korean handwriting three times, find one habit to improve, and keep the style that feels like you.",
    icons: {
      icon: [{ url: "/favicon.png", type: "image/png" }],
      shortcut: "/favicon.png",
      apple: "/favicon.png",
    },
    openGraph: {
      title: "GeulGyeol · Korean Hangul Handwriting Coach",
      description: "Write Korean three times. Improve one handwriting habit.",
      images: [{ url: `${origin}/og.png`, width: 1776, height: 887, alt: "GeulGyeol Korean Hangul handwriting coach" }],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "GeulGyeol · Korean Hangul Handwriting Coach",
      description: "Write Korean three times. Improve one handwriting habit.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
