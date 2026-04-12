import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, Lora } from "next/font/google";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import { AuthProvider } from "../components/AuthContext";
import { AccentSync } from "../components/AccentSync";
import { GlobalSearchShortcut } from "../components/GlobalSearchShortcut";
import { PlansFloatingTab } from "../components/PlansFloatingTab";
import { ThemeProvider } from "../components/ThemeContext";
import { ToastProvider } from "../components/ToastContext";
import { PriceProvider } from "../lib/price-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "QuantivTrade",
  description: "Where the world trades ideas. Real-time market intelligence, social communities, and risk-based investing.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Blocking script: runs synchronously before first paint to prevent accent-color flash */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var k='quantivtrade-accent-color',d='#e8846a',o='#4f9cf9',s=localStorage.getItem(k);if(!s||s.toLowerCase()===o){localStorage.setItem(k,d);}else if(/^#[0-9a-f]{6}$/i.test(s)){document.documentElement.style.setProperty('--accent-color',s);}}catch(e){}})()` }} />
      </head>
      <body
        className={`${geistSans.variable} ${ibmPlexMono.variable} ${lora.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <PriceProvider>
              <ToastProvider>
                <AccentSync />
              <GlobalSearchShortcut />
              <PlansFloatingTab />
                <AppShell>{children}</AppShell>
              </ToastProvider>
            </PriceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
