import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { SignalReady } from "@/components/SignalReady";

const roboto = Roboto({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Crystallize AI Sidebar",
  description: "AI-powered content editing for Crystallize",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className="antialiased">
        <SignalReady />
        {children}
      </body>
    </html>
  );
}
