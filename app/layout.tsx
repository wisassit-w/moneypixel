import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SidebarUser from "@/components/SidebarUser";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "MoneyPixel",
  description: "AI finance + gamification in a 2D pixel room",
};

export const viewport: Viewport = {
  themeColor: "#4e6e58", // updated at runtime by ThemeProvider
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script sets data-theme before React hydrates
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* Phone: top bar above the content. Desktop (md+): sidebar next to the content. */}
      <body className="flex h-dvh flex-col bg-cream text-stone-800 antialiased md:flex-row">
        <ThemeProvider>
          <LanguageProvider>
            <Sidebar
              userSlot={
                <Suspense fallback={null}>
                  <SidebarUser />
                </Suspense>
              }
            />
            <main className="min-h-0 flex-1 overflow-y-auto bg-cream p-4 text-stone-800 sm:p-6 md:p-8">
              {children}
            </main>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}