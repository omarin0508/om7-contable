import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OM7 Finance OS",
  description: "Premium SaaS financial operating system interface.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-[#03050a] font-sans text-slate-100">
        {children}
      </body>
    </html>
  );
}
