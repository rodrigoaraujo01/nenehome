import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { NenecoinsInit } from "@/components/NenecoinsInit";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "nenehome",
  description: "Gamificação do grupo nenequer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <head />
      <body className="min-h-full flex flex-col pb-20">
        {children}
        <BottomNav />
        <NenecoinsInit />
      </body>
    </html>
  );
}
