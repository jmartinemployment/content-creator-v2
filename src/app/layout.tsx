import type { Metadata } from "next";
import { Figtree, Sora } from "next/font/google";
import "./globals.css";

// Sora + Figtree are geekatyourspot.com's own pairing (--font-sora / --font-sans
// there). This app is a subdomain, so it inherits the parent's typography rather
// than picking its own.
const display = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Geek Content Creator",
  description:
    "Find site content gaps, generate with site section context, revise, approve, and repurpose.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
