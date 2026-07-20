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
    title: "글결 · 나만의 한글 필체 코치",
    description: "세 번의 필기 움직임을 비교해 내 글씨의 개성은 지키고, 흔들리는 습관 하나만 교정해요.",
    openGraph: {
      title: "글결 · 나만의 한글 필체 코치",
      description: "세 번 쓰면, 고칠 한 가지가 보여요.",
      images: [{ url: `${origin}/og.png`, width: 1776, height: 887, alt: "글결 한글 필체 코치" }],
      locale: "ko_KR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "글결 · 나만의 한글 필체 코치",
      description: "세 번 쓰면, 고칠 한 가지가 보여요.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
