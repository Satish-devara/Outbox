import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Outbox — Email Scheduler Dashboard",
  description:
    "Production-grade email scheduler service built with BullMQ, Redis, and PostgreSQL. Schedule emails, track their delivery, and monitor your queue in real time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans bg-[#0a0a0f] text-gray-100 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
