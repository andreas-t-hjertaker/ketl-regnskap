import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="no" className={cn("dark", "font-sans", geist.variable)}>
      <body className={`${inter.className} bg-neutral-950 text-neutral-100 antialiased`}>
        <AnalyticsProvider />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
