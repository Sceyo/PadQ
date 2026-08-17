import type { Metadata } from "next";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
