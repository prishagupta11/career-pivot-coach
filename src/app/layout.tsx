import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Career Pivot Coach — Targeted Re-skilling & Transition Engine",
  description: "Empirical career transition coach translating existing experience, analyzing real job descriptions, and building focused learning & portfolio plans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans transition-colors duration-200">
        <Navigation />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Career Pivot Coach &copy; 2026 — Evidence-Based Career Reskilling</span>
            <span className="text-slate-400 dark:text-slate-500">Speech Cleanup • Skill Translation • Real JD Gap Maps • Rubric Interviews</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
