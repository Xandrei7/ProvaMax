import { hero, APP_CHECKOUT_URL } from "@/config/site";
import { CTAButton } from "@/components/ui/CTAButton";
import { Icons } from "@/components/Icons";

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[280px]">
      {/* Glow behind phone */}
      <div className="absolute inset-0 -m-8 bg-indigo-500/20 blur-3xl rounded-full" />

      {/* Phone frame */}
      <div className="relative w-full aspect-[9/19] bg-slate-800 rounded-[36px] border-2 border-slate-700 shadow-2xl shadow-black/60 overflow-hidden">
        {/* Dynamic island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-full z-10" />

        {/* Screen */}
        <div className="absolute inset-0 bg-slate-900 flex flex-col pt-10">
          {/* App header bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 bg-indigo-600 rounded-md flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-2.5 h-2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <span className="text-white font-semibold text-[10px]">ProvaMax</span>
            </div>
            <span className="text-indigo-400 text-[9px] font-medium bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              Simulado
            </span>
          </div>

          {/* Progress area */}
          <div className="px-3.5 pt-2.5 pb-1.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-400 text-[9px]">Questão 12 de 30</span>
              <span className="text-indigo-400 text-[9px] font-medium">40%</span>
            </div>
            <div className="h-1 bg-slate-700 rounded-full">
              <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full w-[40%]" />
            </div>
          </div>

          {/* Question card */}
          <div className="mx-3 bg-slate-800 rounded-xl p-3 border border-slate-700/60">
            <div className="text-[8px] text-slate-500 mb-1.5 font-medium uppercase tracking-wide">
              Direito Administrativo
            </div>
            <p className="text-slate-300 text-[8px] leading-relaxed mb-2.5">
              De acordo com o princípio da legalidade na Administração Pública, o administrador pode agir:
            </p>
            <div className="space-y-1.5">
              {[
                { key: "A", label: "Somente conforme previsto em lei", active: true },
                { key: "B", label: "Segundo sua conveniência e oportunidade" },
                { key: "C", label: "Conforme normas internas exclusivamente" },
                { key: "D", label: "De acordo com a moralidade social" },
              ].map(({ key, label, active }) => (
                <div
                  key={key}
                  className={[
                    "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[8px]",
                    active
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-700/60 text-slate-400",
                  ].join(" ")}
                >
                  <span className="font-bold w-3 shrink-0">{key}</span>
                  <span className="leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mini stats */}
          <div className="px-3 mt-2.5 grid grid-cols-3 gap-1.5">
            <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700/60">
              <div className="text-green-400 font-bold text-[11px]">85%</div>
              <div className="text-slate-600 text-[7.5px] mt-0.5">Acertos</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700/60">
              <div className="text-indigo-400 font-bold text-[11px]">142</div>
              <div className="text-slate-600 text-[7.5px] mt-0.5">Questões</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700/60">
              <div className="text-amber-400 font-bold text-[11px]">7d</div>
              <div className="text-slate-600 text-[7.5px] mt-0.5">Sequência</div>
            </div>
          </div>

          {/* Flashcard preview */}
          <div className="mx-3 mt-2 bg-gradient-to-br from-indigo-600/20 to-violet-600/10 rounded-xl p-2.5 border border-indigo-500/20">
            <div className="text-[7.5px] text-indigo-400 font-medium mb-1">Flashcard — Revisão</div>
            <div className="text-[8px] text-slate-300 leading-tight">
              Qual é o prazo para impugnar ato administrativo nulo?
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden hero-glow">
      {/* Background grid */}
      <div className="absolute inset-0 dot-grid opacity-40" />

      {/* Top gradient fade */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-950 to-transparent" />

      {/* Bottom gradient fade */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
              Treino estratégico para concurso público
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
              <span className="text-white">{hero.headline}</span>
              <br />
              <span className="gradient-text">{hero.headlineAccent}</span>
            </h1>

            {/* Subtitle */}
            <p className="text-slate-400 text-lg sm:text-xl leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0">
              {hero.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
              <CTAButton
                href={APP_CHECKOUT_URL}
                variant="primary"
                size="lg"
                className="text-base font-bold"
              >
                {hero.ctaPrimary}
                <Icons.arrowRight className="w-5 h-5" />
              </CTAButton>

              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 text-base font-semibold text-slate-300 border border-white/10 rounded-xl hover:bg-white/5 hover:border-white/20 transition-all duration-200"
              >
                {hero.ctaSecondary}
              </a>
            </div>

            {/* Trust signals */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 text-slate-500 text-sm">
              <span className="flex items-center gap-1.5">
                <Icons.lock className="w-4 h-4 text-slate-600" />
                Pagamento seguro via Hotmart
              </span>
              <span className="hidden sm:block w-1 h-1 bg-slate-700 rounded-full" />
              <span className="flex items-center gap-1.5">
                <Icons.mail className="w-4 h-4 text-slate-600" />
                {hero.accessNote}
              </span>
            </div>
          </div>

          {/* Right: Phone mockup */}
          <div className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-20 pt-10 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {[
            { value: "+1.000", label: "questões inéditas" },
            { value: "2", label: "modos de simulado" },
            { value: "9", label: "disciplinas cobertas" },
            { value: "100%", label: "padrão FCC" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{value}</div>
              <div className="text-sm text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-slate-600 bounce-y">
        <Icons.arrowDown className="w-5 h-5" />
      </div>
    </section>
  );
}
