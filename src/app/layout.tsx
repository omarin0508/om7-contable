import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/theme-provider";
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
    <html
      className="h-full max-w-full overflow-x-clip antialiased"
      lang="es"
      suppressHydrationWarning
    >
      <body className="min-h-full max-w-full overflow-x-clip bg-background font-sans text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
