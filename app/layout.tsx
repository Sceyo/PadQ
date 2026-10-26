import type { Metadata, Viewport } from "next";
import { AuthResilienceBanner } from "@/components/AuthResilience/AuthResilienceBanner";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0b0d17",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://pad-q.vercel.app"),
  title: {
    default: "PADQ — Fair Live Court Queues",
    template: "%s | PADQ",
  },
  description: "Run fair singles and doubles queues across up to three pickleball or padel courts, with live viewer updates and player performance.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "PADQ — Fair Live Court Queues",
    description: "Smart multi-court queues, live court status, and player performance for pickleball and padel sessions.",
    url: "/",
    siteName: "PADQ",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "PADQ — Fair Live Court Queues",
    description: "Smart multi-court queues with live viewer updates.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AuthResilienceBanner />
        {children}
      </body>
    </html>
  );
}
