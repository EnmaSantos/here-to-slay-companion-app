import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Here to Slay — The online table",
  description:
    "Small heroes. Big monsters. Questionable friends. A private online table for Here to Slay.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
