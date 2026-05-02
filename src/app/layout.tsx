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
      <head>
        {/* Restore path after 404.html SPA redirect on GitHub Pages */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var q = window.location.search;
            if (q && q[1] === 'p') {
              var path = q.slice(3).replace(/^\//, '').replace(/~and~/g, '&');
              var extra = q.indexOf('&q=') !== -1
                ? '?' + q.slice(q.indexOf('&q=') + 3).replace(/~and~/g, '&')
                : '';
              window.history.replaceState(
                null, null,
                window.location.pathname.replace(/\\/$/, '') + '/' + path + extra + window.location.hash
              );
            }
          })();
        `}} />
      </head>
      <body className="min-h-full flex flex-col pb-20">
        {children}
        <BottomNav />
        <NenecoinsInit />
      </body>
    </html>
  );
}
