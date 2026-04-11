export function Simulados() {
  return (
    <section className="bg-slate-900 py-24 sm:py-32 overflow-hidden relative">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(99,102,241,0.12)_0%,transparent_60%)]" />
      <div className="absolute inset-0 dot-grid opacity-20" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 text-indigo-400 text-sm font-semibold uppercase tracking-wider mb-5">
            <span className="w-8 h-px bg-indigo-600" />
            Simulados
            <span className="w-8 h-px bg-indigo-600" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-6">
            Simule a prova.{" "}
            <span className="text-indigo-400">Antes da prova.</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Não basta resolver questões isoladas. O ProvaMax tem dois modos de simulado com lógicas distintas — porque a preparação tem fases, e cada fase exige um tipo de treino diferente.
          </p>
        </div>

        {/* Mode cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {/* Básico */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-8 backdrop-blur-sm">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-500/15 border border-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-indigo-400 font-bold text-lg">B</span>
              </div>
              <div>
                <div className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  Modo
                </div>
                <h3 className="text-white font-bold text-xl">Básico</h3>
              </div>
            </div>

            <p className="text-slate-400 text-base leading-relaxed mb-6">
              Ideal para as fases iniciais da preparação. O simulado básico trabalha com blocos de questões organizados de forma mais linear, permitindo consolidar o conteúdo com profundidade antes de misturar assuntos.
            </p>

            <ul className="space-y-3">
              {[
                "Questões segmentadas por disciplina",
                "Ritmo progressivo de dificuldade",
                "Ideal para quem está construindo base",
                "Estatísticas por área de conhecimento",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Avançado */}
          <div className="bg-gradient-to-br from-indigo-600/20 to-violet-600/10 border border-indigo-500/25 rounded-2xl p-8 relative overflow-hidden">
            {/* Glow */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 blur-2xl rounded-full -translate-y-8 translate-x-8" />

            <div className="relative flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-500/25 border border-indigo-400/30 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-indigo-300 font-bold text-lg">A</span>
              </div>
              <div>
                <div className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  Modo
                </div>
                <h3 className="text-white font-bold text-xl">Avançado</h3>
              </div>
            </div>

            <p className="text-slate-300 text-base leading-relaxed mb-6">
              Para quem já tem base e quer simular as condições reais da prova. O modo avançado alterna pequenos blocos de questões entre disciplinas diferentes — exatamente como acontece em uma prova de concurso real.
            </p>

            <ul className="space-y-3">
              {[
                "Alternância estratégica de assuntos",
                "Treino de reconhecimento e adaptação rápida",
                "Simula a pressão real do dia da prova",
                "Desempenho cruzado entre disciplinas",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-indigo-200">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Alternation explanation */}
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-8 max-w-3xl mx-auto text-center">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-6 h-6 text-amber-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
          </div>
          <h3 className="text-white font-bold text-lg mb-3">
            Por que a alternância de assuntos importa?
          </h3>
          <p className="text-slate-400 text-base leading-relaxed">
            Em uma prova de concurso, você não responde 10 questões de Português e depois 10 de Direito. Os assuntos se misturam — e seu cérebro precisa identificar rapidamente qual estratégia e qual base de conhecimento aplicar. O modo avançado treina exatamente essa habilidade: reconhecer o tema e adaptar a abordagem em segundos.
          </p>
        </div>
      </div>
    </section>
  );
}
