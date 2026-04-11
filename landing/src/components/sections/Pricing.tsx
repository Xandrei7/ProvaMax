import { APP_NAME, APP_CURRENCY, APP_PRICE, APP_BILLING_PERIOD, APP_BILLING_LABEL } from "@/config/site";
import { CTAButton } from "@/components/ui/CTAButton";
import { Icons } from "@/components/Icons";

const includes = [
  "+1.000 questões inéditas",
  "Questões no padrão e estilo FCC",
  "Edital completo coberto (9 disciplinas)",
  "Simulado básico e avançado",
  "Flashcards de revisão ativa",
  "Estatísticas detalhadas de desempenho",
  "Histórico completo de simulados",
  "Acesso responsivo pelo celular",
  "Atualizações de conteúdo inclusas",
  "Acesso liberado por e-mail após pagamento",
];

export function Pricing() {
  return (
    <section className="bg-slate-950 py-24 sm:py-32 overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(99,102,241,0.15)_0%,transparent_60%)]" />
      <div className="absolute inset-0 dot-grid opacity-15" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-indigo-400 text-sm font-semibold uppercase tracking-wider mb-5">
            <span className="w-8 h-px bg-indigo-600" />
            Investimento
            <span className="w-8 h-px bg-indigo-600" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-5">
            Treino de alto nível.{" "}
            <span className="text-indigo-400">Preço acessível.</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Assine mensalmente e tenha acesso a tudo. Sem contrato de fidelidade, sem plano básico, sem funcionalidade bloqueada.
          </p>
        </div>

        {/* Pricing card */}
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-indigo-500/10">
            {/* Card header */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-8 text-center">
              <div className="inline-flex items-center gap-2 bg-white/15 text-white text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-full mb-4">
                <span className="w-1.5 h-1.5 bg-amber-300 rounded-full" />
                Acesso completo
              </div>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-indigo-200 text-2xl font-medium">{APP_CURRENCY}</span>
                <span className="text-white font-bold text-7xl tracking-tight leading-none">{APP_PRICE}</span>
                <span className="text-indigo-200 text-2xl font-medium">{APP_BILLING_PERIOD}</span>
              </div>
              <p className="text-indigo-200 text-sm mt-2">
                {APP_BILLING_LABEL} · Cancele quando quiser
              </p>
            </div>

            {/* Card body */}
            <div className="p-8">
              <p className="text-slate-500 text-sm text-center mb-6 font-medium uppercase tracking-wide">
                Tudo incluído
              </p>
              <ul className="space-y-3 mb-8">
                {includes.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-700 text-sm">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                      <Icons.check className="w-3 h-3 text-green-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <CTAButton
                variant="primary"
                size="lg"
                fullWidth
                className="text-base font-bold justify-center"
              >
                Assinar por {APP_CURRENCY} {APP_PRICE}{APP_BILLING_PERIOD}
                <Icons.arrowRight className="w-5 h-5" />
              </CTAButton>

              {/* Trust */}
              <div className="mt-5 flex items-center justify-center gap-4 text-slate-400 text-xs">
                <span className="flex items-center gap-1.5">
                  <Icons.shield className="w-3.5 h-3.5" />
                  Pagamento seguro
                </span>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="flex items-center gap-1.5">
                  <Icons.mail className="w-3.5 h-3.5" />
                  Acesso por e-mail
                </span>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="flex items-center gap-1.5">
                  <Icons.lock className="w-3.5 h-3.5" />
                  Hotmart
                </span>
              </div>
            </div>
          </div>

          {/* Below card note */}
          <p className="text-center text-slate-600 text-sm mt-6 leading-relaxed">
            Após a confirmação da assinatura, você recebe o link de acesso ao{" "}
            <span className="text-slate-400 font-medium">{APP_NAME}</span> direto no e-mail.
            <br />
            Pix, cartão de crédito ou boleto bancário. Cancele quando quiser.
          </p>
        </div>
      </div>
    </section>
  );
}
