import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/app/auth/cookies";
import { ProductShell } from "@/app/components/product-shell";
import "./globals.css";

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Content Creator",
  description: "Create evidence-backed content from one guided workspace.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const signedIn = Boolean(jar.get(ACCESS_COOKIE)?.value);

  return (
    <html lang="en" className={`${body.variable} h-full antialiased`}>
      <body className="min-h-full">
        {signedIn ? <ProductShell>{children}</ProductShell> : children}
      </body>
    </html>
  );
}
