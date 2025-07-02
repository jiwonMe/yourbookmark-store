import type { Metadata } from "next";
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
  title: "당신의 책갈피 - 온라인 도서 재고 관리 시스템",
  description: "실시간 도서 검색, 랜덤 추천, 참고문헌 자동 복사 기능을 제공하는 온라인 서점입니다. 재고 확인부터 주문까지 한 번에!",
  keywords: ["도서", "책", "서점", "재고", "검색", "추천", "참고문헌", "온라인서점", "북스토어"],
  authors: [{ name: "당신의 책갈피" }],
  creator: "당신의 책갈피",
  publisher: "당신의 책갈피",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://yourbookmark.vercel.app",
    title: "당신의 책갈피 - 온라인 도서 재고 관리 시스템",
    description: "실시간 도서 검색, 랜덤 추천, 참고문헌 자동 복사 기능을 제공하는 온라인 서점입니다.",
    siteName: "당신의 책갈피",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "당신의 책갈피 - 온라인 서점",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "당신의 책갈피 - 온라인 도서 재고 관리 시스템",
    description: "실시간 도서 검색, 랜덤 추천, 참고문헌 자동 복사 기능을 제공하는 온라인 서점",
    images: ["/og-image.png"],
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: "#1e293b",
  category: "shopping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Bookstore",
              "name": "당신의 책갈피",
              "description": "실시간 도서 검색, 랜덤 추천, 참고문헌 자동 복사 기능을 제공하는 온라인 서점",
              "url": "https://yourbookmark.vercel.app",
              "logo": "https://yourbookmark.vercel.app/logo.png",
              "sameAs": [],
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "KR"
              },
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "도서 카탈로그",
                "itemListElement": [
                  {
                    "@type": "OfferCatalog",
                    "name": "일반 도서"
                  }
                ]
              },
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://yourbookmark.vercel.app?search={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
