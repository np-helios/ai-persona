import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Persona",
  description: "RAG-grounded AI representative with calendar booking"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
