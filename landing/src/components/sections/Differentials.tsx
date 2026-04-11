import { Icons } from "@/components/Icons";

const differentials = [
  {
    title: "Construído para a prova, não para o estudo",
    description:
      "Cada recurso foi pensado com a lógica de quem vai fazer uma prova — não apenas ler teoria. Questões, simulados e flashcards funcionam em conjunto para criar um ciclo completo de treino.",
  },
  {
    title: "Questões com padrão de banca real",
    description:
      "As questões do ProvaMax foram desenvolvidas respeitando o estilo, a linguagem e o nível de exigência da banca FCC — para que o treino seja o mais próximo possível da prova real.",
  },
  {
    title: "Organização que acelera a preparação",
    description:
      "Sem depender de você organizar, o ProvaMax estrutura o conteúdo por disciplina, por área e por nível. Você entra, treina e sabe exatamente onde está na sua preparação.",
  },
  {
    title: "Revisão ativa, não passiva",
    description:
      "Os flashcards do ProvaMax não são resumos para ler — são ferramentas de recuperação ativa de memória. Você é forçado a lembrar, não apenas reconhecer. Isso faz toda a diferença na retenção.",
  },
];

export function Differentials() {
  return (
    <section className="bg-white py-24 sm:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Visual */}
          <div className="relative order-2 lg:order-1">
            <div className="absolute -inset-8 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-3xl -z-10" />

            {/* Main card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <div>
                  <div className="text-slate-900 font-bold text-sm">ProvaMax</div>
                  <div className="text-slate-500 text-xs">Desempenho semanal</div>
                </div>
              </div>

              {/* Mock progress bars */}
              <div className="space-y-4">
                {[
                  { label: "Direito Administrativo", pct: 78, color: "bg-indigo-500" },
                  { label: "Língua Portuguesa", pct: 91, color: "bg-violet-500" },
                  { label: "Dir. Constitucional", pct: 65, color: "bg-blue-500" },
                  { label: "Leg. Institucional", pct: 84, color: "bg-emerald-500" },
                ].map(({ label, pct, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-700 font-medium">{label}</span>
                      <span className="text-slate-500">{pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full">
                      <div
                        className={`h-2 rounded-full ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Mini stats row */}
              <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-slate-900 font-bold text-lg">312</div>
                  <div className="text-slate-500 text-xs">questões</div>
                </div>
                <div>
                  <div className="text-green-600 font-bold text-lg">80%</div>
                  <div className="text-slate-500 text-xs">acertos</div>
                </div>
                <div>
                  <div className="text-indigo-600 font-bold text-lg">14d</div>
                  <div className="text-slate-500 text-xs">sequência</div>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -right-4 bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/30">
              Evolução em tempo real
            </div>
          </div>

          {/* Right: Text */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 text-indigo-600 text-sm font-semibold uppercase tracking-wider mb-5">
              <span className="w-8 h-px bg-indigo-400" />
              Por que o ProvaMax é diferente
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-8">
              Um sistema pensado para{" "}
              <span className="gradient-text-indigo">desempenho.</span>
            </h2>

            <div className="space-y-6">
              {differentials.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Icons.check className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-semibold text-base mb-1">
                      {item.title}
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
