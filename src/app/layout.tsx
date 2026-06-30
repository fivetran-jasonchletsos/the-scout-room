import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import TopNav from "@/components/TopNav";
import Footer from "@/components/Footer";
import Script from "next/script";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Scout Room — Baseball analytics like you've never seen",
  description:
    "Pick your team and your home state. Get a personalized scout report blending 150 years of MLB data, Cortex-style player comping, and narrative summaries. Powered by Fivetran ODI + Snowflake Cortex.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070912",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen flex flex-col bg-abyss text-chalk antialiased">
        <TopNav />
        <div className="flex-1">{children}</div>
        <Footer />
        <Script src="/feedback-widget.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
