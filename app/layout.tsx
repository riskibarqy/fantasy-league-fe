import type { Metadata } from "next";
import "../src/styles/global.css";

export const metadata: Metadata = {
  title: "Fantasy Nusantara",
  description: "Fantasy league app for Indonesian football with mobile-first web UX."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
