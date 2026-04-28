import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Investment Autopilot — AI Stock Recommender",
  description: "AI-powered financial intelligence for Indian and US stock markets. Get daily trading recommendations before market open.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
