import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { AuthProvider } from "@/context/AuthContext";
import ClientShell from "@/components/layout/ClientShell";

export const metadata: Metadata = {
  title: "StudyPulse — Study Planner and Flashcards",
  description: "Flashcards with spaced repetition, a focus timer, exams, timetable and a study calendar in one app.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "StudyPulse", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "StudyPulse — Study Planner and Flashcards",
    description: "Flashcards, focus timer, exams, timetable and a study calendar in one app.",
    url: "https://studypulse-tracker-app.web.app",
    siteName: "StudyPulse",
    images: [
      {
        url: "https://studypulse-tracker-app.web.app/og.svg",
        width: 1200,
        height: 630,
        alt: "StudyPulse — Study Planner and Flashcards",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StudyPulse — Study Planner and Flashcards",
    description: "Flashcards, focus timer, exams, timetable and a study calendar in one app.",
    images: ["https://studypulse-tracker-app.web.app/og.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#131316",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500;600&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
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
