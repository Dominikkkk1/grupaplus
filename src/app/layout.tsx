import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Grupa Plus — System produkcyjny",
  description: "MES + CRM dla drukarni Grupa Plus",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-montserrat)]">
        {children}
      </body>
    </html>
  );
}
