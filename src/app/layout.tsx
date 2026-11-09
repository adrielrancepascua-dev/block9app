import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Caveat, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/SupabaseAuthContext";
import Navbar from "@/components/Navbar";
import { Toaster } from 'sonner';
import EnvWarning from '@/components/EnvWarning';
import NameGate from "@/components/NameGate";
import { ThemeProvider } from "@/context/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const noteHand = Caveat({
  variable: "--font-note",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Block9 - Class Schedule Tracker",
  description: "Manage your class schedules and attendance seamlessly",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Block9",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${noteHand.variable} font-sans antialiased`}>
        <Script id="block9-theme" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("block9-theme")||"system";var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`}
        </Script>
        <ThemeProvider>
        <AuthProvider>
          <NameGate>
            <Navbar />
            {process.env.NODE_ENV !== "production" && <EnvWarning />}
            {children}
            <Toaster position="top-center" richColors />
          </NameGate>
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
