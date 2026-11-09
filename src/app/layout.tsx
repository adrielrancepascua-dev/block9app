import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Caveat, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/SupabaseAuthContext";
import Navbar from "@/components/Navbar";
import { Toaster } from 'sonner';
import EnvWarning from '@/components/EnvWarning';
import NameGate from "@/components/NameGate";
import InstallPrompt from "@/components/InstallPrompt";
import { ThemeProvider } from "@/context/ThemeContext";
import startupImages from "@/lib/pwa-splash.json";

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
  applicationName: "Block 9",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Block 9",
    startupImage: startupImages,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#101c2e" },
  ],
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
          {`(function(){try{var t=localStorage.getItem("block9-theme")||"system";var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";var c=d?"#101c2e":"#f7f4ef";document.querySelectorAll('meta[name="theme-color"]').forEach(function(n){n.setAttribute("content",c);});}catch(e){}})();`}
        </Script>
        <ThemeProvider>
        <AuthProvider>
          <NameGate>
            <Navbar />
            {process.env.NODE_ENV !== "production" && <EnvWarning />}
            {children}
            <InstallPrompt />
            <Toaster position="top-center" richColors />
          </NameGate>
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
