import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/components/analytics-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ketlcloud",
  description: "SaaS foundation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no" className="dark">
      <body className={`${inter.className} bg-neutral-950 text-neutral-100 antialiased`}>
        <AnalyticsProvider />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
