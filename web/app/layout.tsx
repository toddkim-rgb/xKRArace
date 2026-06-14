import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "서울 경마 출마표",
  description: "KRA 서울 경마장 상세 출마표 뷰어",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-zinc-900 dark:bg-slate-950 dark:text-zinc-100">
        <header className="sticky top-0 z-30 border-b border-black/10 bg-navy text-white shadow-sm">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-base font-extrabold tracking-tight"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
              서울 경마 출마표
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                경주
              </Link>
              <Link
                href="/predictions"
                className="rounded-lg px-3 py-1.5 font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                예상
              </Link>
              <Link
                href="/stats"
                className="rounded-lg px-3 py-1.5 font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                통계
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
