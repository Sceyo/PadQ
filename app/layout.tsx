import type { Metadata, Viewport } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import { AuthResilienceBanner } from "@/components/AuthResilience/AuthResilienceBanner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bebas-neue",
});

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
    <html lang="en" className={`h-full antialiased ${inter.variable} ${bebasNeue.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <AuthResilienceBanner />
        {children}
      </body>
    </html>
  );
}
