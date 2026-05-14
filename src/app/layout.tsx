import type { Metadata } from "next";
import "@/app/globals.css";
import { AuthProvider } from "@/context/AuthContext";
import ClientShell from "@/components/layout/ClientShell";

export const metadata: Metadata = {
  title: "StudyPulse — AI Study Tracker",
  description: "Track your study sessions, monitor progress, and hit your academic goals.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "StudyPulse — AI Study Tracker",
    description: "Track every session. Build unstoppable momentum. Join 10,000+ students.",
    url: "https://studypulse-tracker-app.web.app",
    siteName: "StudyPulse",
    images: [
      {
        url: "https://studypulse-tracker-app.web.app/og.svg",
        width: 1200,
        height: 630,
        alt: "StudyPulse — AI Study Tracker",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StudyPulse — AI Study Tracker",
    description: "Track every session. Build unstoppable momentum. Join 10,000+ students.",
    images: ["https://studypulse-tracker-app.web.app/og.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@500;600&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface">
        <AuthProvider>
          <ClientShell>
            {children}
          </ClientShell>
        </AuthProvider>
      </body>
    </html>
  );
}
