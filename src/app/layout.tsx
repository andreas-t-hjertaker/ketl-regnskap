import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ConsentBanner } from "@/components/consent-banner";
import { WebsiteJsonLd } from "@/components/json-ld";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ketlregnskap.web.app"),
  title: {
    default: "ketl regnskap",
    template: "%s | ketl regnskap",
  },
  description:
    "AI-drevet regnskapsmedarbeider for norske småbedrifter. Automatisk bokføring, bilagshåndtering og rapportering.",
  manifest: "/manifest.json",
  openGraph: {
    title: "ketl regnskap",
    description:
      "AI-drevet regnskapsmedarbeider for norske småbedrifter. Automatisk bokføring, bilagshåndtering og rapportering.",
    type: "website",
    siteName: "ketl regnskap",
    locale: "nb_NO",
  },
  twitter: {
    card: "summary_large_image",
    title: "ketl regnskap",
    description:
      "AI-drevet regnskapsmedarbeider for norske småbedrifter.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <WebsiteJsonLd
          name="ketl regnskap"
          url="https://ketlregnskap.web.app"
          description="AI-drevet regnskapsmedarbeider for norske småbedrifter."
        />
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <AnalyticsProvider />
              {children}
              <Toaster />
              <ConsentBanner />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
