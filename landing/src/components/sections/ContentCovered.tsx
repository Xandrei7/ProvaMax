import { disciplines } from "@/config/site";

const disciplineIcons: Record<string, string> = {
  "Língua Portuguesa": "📝",
  "Legislação Institucional": "🏛️",
  "Geografia e História de Roraima": "🗺️",
  "Direito Constitucional": "⚖️",
  "Direito Administrativo": "📋",
  "Noções de Administração Financeira e Orçamentária": "💰",
  "Noções de Administração Pública": "🏢",
  "Noções de Processo Legislativo": "📜",
  "Noções de Legística": "🔖",
};

export function ContentCovered() {
  return (
    <section className="bg-slate-50 py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 text-indigo-600 text-sm font-semibold uppercase tracking-wider mb-5">
            <span className="w-8 h-px bg-indigo-400" />
            Conteúdo coberto
            <span className="w-8 h-px bg-indigo-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight mb-5">
            Todo o edital.{" "}
            <span className="gradient-text-indigo">Nenhum ponto de fora.</span>
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            O ProvaMax cobre todas as disciplinas exigidas no edital — organizadas de forma clara para que você saiba exatamente o que está treinando.
          </p>
        </div>

        {/* Disciplines grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {disciplines.map((discipline, index) => (
            <div
              key={discipline}
              className="group bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4 shadow-sm hover:border-indigo-200 hover:shadow-indigo-50 hover:shadow-md transition-all duration-200 card-hover"
            >
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors duration-200 text-lg">
                {disciplineIcons[discipline] || "📚"}
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium mb-0.5">
                  Disciplina {String(index + 1).padStart(2, "0")}
                </div>
                <div className="text-slate-800 font-semibold text-sm leading-tight">
                  {discipline}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-6 py-4 shadow-sm">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-green-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-slate-600 text-sm text-left leading-relaxed">
              <span className="font-semibold text-slate-800">{disciplines.length} disciplinas cobertas</span> — conteúdo organizado, atualizado e estruturado de acordo com o edital.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
