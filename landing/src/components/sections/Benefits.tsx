import { benefits } from "@/config/site";
import { DynamicIcon } from "@/components/Icons";

const iconColorMap: Record<string, string> = {
  layers: "text-indigo-600 bg-indigo-50",
  sparkle: "text-violet-600 bg-violet-50",
  target: "text-blue-600 bg-blue-50",
  book: "text-emerald-600 bg-emerald-50",
  refresh: "text-teal-600 bg-teal-50",
  chart: "text-orange-600 bg-orange-50",
  lightning: "text-amber-600 bg-amber-50",
  card: "text-pink-600 bg-pink-50",
  history: "text-slate-600 bg-slate-100",
  phone: "text-cyan-600 bg-cyan-50",
  split: "text-purple-600 bg-purple-50",
};

export function Benefits() {
  return (
    <section className="bg-slate-50 py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 text-indigo-600 text-sm font-semibold uppercase tracking-wider mb-5">
            <span className="w-8 h-px bg-indigo-400" />
            O que você encontra
            <span className="w-8 h-px bg-indigo-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight mb-5">
            Tudo que você precisa,{" "}
            <span className="gradient-text-indigo">em um só lugar.</span>
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            O ProvaMax reúne as ferramentas certas para quem quer treinar com direção — sem depender de múltiplos sistemas ou plataformas genéricas.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {benefits.map((benefit) => {
            const colorClass = iconColorMap[benefit.icon] || "text-indigo-600 bg-indigo-50";
            return (
              <div
                key={benefit.title}
                className="bg-white rounded-2xl p-6 border border-slate-200/70 shadow-sm card-hover"
              >
                <div
                  className={[
                    "w-11 h-11 rounded-xl flex items-center justify-center mb-4",
                    colorClass,
                  ].join(" ")}
                >
                  <DynamicIcon name={benefit.icon} className="w-5 h-5" />
                </div>
                <h3 className="text-slate-900 font-semibold text-base mb-2">
                  {benefit.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
