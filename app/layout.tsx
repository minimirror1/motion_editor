import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motion CSV Studio",
  description: "Motion CSV editor UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
