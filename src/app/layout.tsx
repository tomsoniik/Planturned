import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Notifications from "@/components/Notifications";
import MotionProvider from "@/components/MotionProvider";
import I18nProvider from "@/components/I18nProvider";
import { getLang } from "@/lib/i18n-server";
import { getContent } from "@/lib/cms/store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

// Adres produkcji na Vercelu; lokalnie localhost. Potrzebny, żeby obrazek OG miał pełny adres.
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000';

// Tytuł, opis i obrazek do udostępniania z panelu /admin (domyślnie ze słownika i public/og.png)
export async function generateMetadata(): Promise<Metadata> {
  const [lang, seo] = await Promise.all([getLang(), getContent('seo')]);
  const title = seo.title[lang];
  const description = seo.description[lang];
  const images = [seo.ogImage || '/og.png'];
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: { title, description, images, siteName: 'Untmatica', type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images },
  };
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
