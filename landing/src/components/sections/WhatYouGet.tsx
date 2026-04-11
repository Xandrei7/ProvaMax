import { APP_CURRENCY, APP_PRICE } from "@/config/site";
import { Icons } from "@/components/Icons";
import { CTAButton } from "@/components/ui/CTAButton";

const items = [
  { label: "Acesso completo à plataforma ProvaMax", highlight: false },
  { label: "+1.000 questões inéditas", highlight: true },
  { label: "Questões no estilo e padrão FCC", highlight: false },
  { label: "Conteúdo cobrindo o edital completo", highlight: false },
  { label: "Divisão entre conhecimentos gerais e específicos", highlight: false },
  { label: "Simulado modo básico", highlight: false },
  { label: "Simulado modo avançado com alternância estratégica", highlight: true },
  { label: "Sistema de flashcards de revisão ativa", highlight: false },
  { label: "Estatísticas detalhadas de desempenho", highlight: false },
  { label: "Histórico completo de simulados realizados", highlight: false },
  { label: "Acesso responsivo pelo celular", highlight: false },
  { label: "Atualizações de conteúdo inclusas", highlight: false },
];

export function WhatYouGet() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left: List */}
          <div>
            <div className="inline-flex items-center gap-2 text-indigo-600 text-sm font-semibold uppercase tracking-wider mb-5">
              <span className="w-8 h-px bg-indigo-400" />
              O que você recebe
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-3">
              Acesso completo.{" "}
              <span className="gradient-text-indigo">Sem exceção.</span>
            </h2>
            <p className="text-slate-600 text-base leading-relaxed mb-10">
              Ao adquirir o ProvaMax, você libera tudo o que a plataforma tem a oferecer — sem plano básico, sem funcionalidade bloqueada, sem surpresa.
            </p>

            <ul className="space-y-3">
              {items.map(({ label, highlight }) => (
                <li
                  key={label}
                  className={[
                    "flex items-center gap-3 rounded-xl px-4 py-3",
                    highlight
                      ? "bg-indigo-50 border border-indigo-100"
                      : "bg-slate-50 border border-slate-100",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                      highlight
                        ? "bg-indigo-600 text-white"
                        : "bg-green-100 text-green-600",
                    ].join(" ")}
                  >
                    <Icons.check className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={[
                      "text-sm font-medium",
                      highlight ? "text-indigo-800" : "text-slate-700",
                    ].join(" ")}
                  >
                    {label}
                  </span>
                  {highlight && (
                    <span className="ml-auto text-xs text-indigo-500 font-semibold bg-indigo-100 px-2 py-0.5 rounded-full shrink-0">
                      Destaque
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Value card */}
          <div className="lg:sticky lg:top-24">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                Acesso completo por apenas
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-slate-400 text-xl font-medium">{APP_CURRENCY}</span>
                  <span className="text-white font-bold text-6xl tracking-tight">{APP_PRICE}</span>
                </div>
                <p className="text-slate-400 text-sm">
                  Pagamento único • Sem assinatura • Sem taxa mensal
                </p>
              </div>

              {/* Highlights */}
              <div className="space-y-2.5 mb-8">
                {[
                  "+1.000 questões inéditas",
                  "2 modos de simulado estratégico",
                  "Flashcards + estatísticas + histórico",
                  "Edital completo coberto",
                  "Acesso por e-mail após pagamento",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-slate-300 text-sm">
                    <Icons.check className="w-4 h-4 text-indigo-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <CTAButton
                variant="primary"
                size="lg"
                fullWidth
                className="text-base font-bold justify-center"
              >
                Garantir meu acesso agora
                <Icons.arrowRight className="w-5 h-5" />
              </CTAButton>

              {/* Trust note */}
              <div className="mt-5 flex items-center justify-center gap-2 text-slate-500 text-xs">
                <Icons.lock className="w-3.5 h-3.5" />
                <span>Pagamento seguro via Hotmart • Acesso por e-mail</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
