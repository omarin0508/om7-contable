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
    <html lang="es" className="h-full max-w-full overflow-x-clip antialiased">
      <body className="min-h-full max-w-full overflow-x-clip bg-[#03050a] font-sans text-slate-100">
        {children}
      </body>
    </html>
  );
}
