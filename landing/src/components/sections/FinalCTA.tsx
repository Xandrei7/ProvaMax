import { APP_NAME, APP_CURRENCY, APP_PRICE, APP_BILLING_PERIOD } from "@/config/site";
import { CTAButton } from "@/components/ui/CTAButton";
import { Icons } from "@/components/Icons";

export function FinalCTA() {
  return (
    <section className="bg-slate-950 py-24 sm:py-32 overflow-hidden relative">
      {/* Background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(99,102,241,0.12)_0%,transparent_70%)]" />
      <div className="absolute inset-0 dot-grid opacity-20" />

      {/* Decorative orbs */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-indigo-600/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-semibold px-5 py-2 rounded-full mb-10">
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
          Pronto para começar de verdade?
        </div>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight mb-6">
          O próximo passo é{" "}
          <span className="gradient-text">treinar com método.</span>
        </h2>

        {/* Subtitle */}
        <p className="text-slate-400 text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
          Mais de 1.000 questões inéditas, simulados estratégicos, flashcards e estatísticas de desempenho — por{" "}
          <span className="text-white font-semibold">
            {APP_CURRENCY} {APP_PRICE}{APP_BILLING_PERIOD}.
          </span>
          <br />
          Assinatura mensal. Acesso por e-mail. Cancele quando quiser.
        </p>

        {/* Value props row */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {[
            "Questões inéditas FCC",
            "Simulados estratégicos",
            "Flashcards de revisão",
            "Estatísticas em tempo real",
            "Acesso pelo celular",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/60 text-slate-300 text-sm px-4 py-2 rounded-lg"
            >
              <Icons.check className="w-4 h-4 text-indigo-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <CTAButton
            variant="primary"
            size="lg"
            className="text-lg font-bold px-10 py-5"
          >
            Assinar agora — {APP_CURRENCY} {APP_PRICE}{APP_BILLING_PERIOD}
            <Icons.arrowRight className="w-5 h-5" />
          </CTAButton>
        </div>

        {/* Trust signals */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-slate-600 text-sm">
          <span className="flex items-center gap-2">
            <Icons.shield className="w-4 h-4" />
            Pagamento seguro via Hotmart
          </span>
          <span className="hidden sm:block w-1 h-1 bg-slate-700 rounded-full" />
          <span className="flex items-center gap-2">
            <Icons.mail className="w-4 h-4" />
            Acesso enviado por e-mail
          </span>
          <span className="hidden sm:block w-1 h-1 bg-slate-700 rounded-full" />
          <span className="flex items-center gap-2">
            <Icons.phone className="w-4 h-4" />
            Funciona no celular
          </span>
        </div>
      </div>
    </section>
  );
}
