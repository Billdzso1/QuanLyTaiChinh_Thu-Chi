import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NDAHOME Management — Hệ thống Quản lý Nội bộ",
  description: "Website quản lý tài chính, nhân sự, lương, chấm công và hoạt động nội bộ Công ty NDAHOME",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full bg-white text-neutral-900 font-sans">{children}</body>
    </html>
  );
}
