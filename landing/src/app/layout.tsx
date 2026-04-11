import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_PRICE, APP_CURRENCY, APP_CHECKOUT_URL } from "@/config/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — Treino Estratégico para Concurso Público`,
  description: `Questões inéditas no estilo FCC, simulados estratégicos e flashcards de revisão ativa. Acesse o ${APP_NAME} e transforme seu estudo em desempenho real por ${APP_CURRENCY} ${APP_PRICE}.`,
  keywords: [
    "concurso público",
    "questões FCC",
    "simulado concurso",
    "flashcards concurso",
    "preparação concurso",
    "treino concurso",
    "ProvaMax",
  ],
  openGraph: {
    title: `${APP_NAME} — Treino Estratégico para Concurso Público`,
    description: `Questões inéditas no estilo FCC, simulados estratégicos e flashcards de revisão. Acesso por ${APP_CURRENCY} ${APP_PRICE}.`,
    type: "website",
    locale: "pt_BR",
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    "theme-color": "#020617",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
