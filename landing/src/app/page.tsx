import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/sections/Hero";
import { StudyIsNotEnough } from "@/components/sections/StudyIsNotEnough";
import { Benefits } from "@/components/sections/Benefits";
import { Differentials } from "@/components/sections/Differentials";
import { Simulados } from "@/components/sections/Simulados";
import { WhatYouGet } from "@/components/sections/WhatYouGet";
import { ContentCovered } from "@/components/sections/ContentCovered";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Pricing } from "@/components/sections/Pricing";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";

export default function Home() {
  return (
    <>
      <Header />

      <main>
        {/* 1. Hero */}
        <Hero />

        {/* 2. Estudar não basta */}
        <StudyIsNotEnough />

        {/* 3. Benefícios */}
        <Benefits />

        {/* 4. Diferenciais */}
        <Differentials />

        {/* 5. Simulados */}
        <Simulados />

        {/* 6. O que você recebe */}
        <WhatYouGet />

        {/* 7. Conteúdo coberto */}
        <ContentCovered />

        {/* 8. Como funciona */}
        <HowItWorks />

        {/* 9. Preço */}
        <Pricing />

        {/* 10. FAQ */}
        <FAQ />

        {/* 11. CTA final */}
        <FinalCTA />
      </main>

      <Footer />
    </>
  );
}
