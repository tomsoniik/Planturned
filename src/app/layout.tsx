import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Notifications from "@/components/Notifications";
import MotionProvider from "@/components/MotionProvider";
import I18nProvider from "@/components/I18nProvider";
import { getLang } from "@/lib/i18n-server";
import { DICTS } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = DICTS[await getLang()];
  return { title: meta.title, description: meta.description };
}

export const viewport: Viewport = {
  themeColor: "#0b100c",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <I18nProvider initialLang={lang}>
          <MotionProvider>{children}</MotionProvider>
          <Notifications />
        </I18nProvider>
      </body>
    </html>
  );
}
