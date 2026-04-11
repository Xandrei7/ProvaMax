import { problemSection } from "@/config/site";
import { Icons } from "@/components/Icons";

export function StudyIsNotEnough() {
  return (
    <section className="bg-white py-24 sm:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 text-indigo-600 text-sm font-semibold uppercase tracking-wider mb-5">
            <span className="w-8 h-px bg-indigo-400" />
            {problemSection.eyebrow}
            <span className="w-8 h-px bg-indigo-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight mb-6">
            {problemSection.headline}
            <br />
            <span className="gradient-text-indigo">{problemSection.headlineAccent}</span>
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            {problemSection.subtitle}
          </p>
        </div>

        {/* Comparison grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* What doesn't work */}
          <div className="relative bg-slate-50 border border-slate-200 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <Icons.x className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <div className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-0.5">
                  {problemSection.badLabel}
                </div>
                <h3 className="text-slate-800 font-semibold text-base">
                  {problemSection.badTitle}
                </h3>
              </div>
            </div>
            <ul className="space-y-3.5">
              {problemSection.badItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5 shrink-0">
                    <Icons.x className="w-3 h-3 text-red-400" />
                  </div>
                  <span className="text-slate-600 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>

            {/* Result badge */}
            <div className="mt-6 pt-5 border-t border-slate-200">
              <p className="text-sm text-slate-500 italic">
                {problemSection.resultBad}
              </p>
            </div>
          </div>

          {/* What works */}
          <div className="relative bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-8 shadow-xl shadow-indigo-500/20">
            {/* Subtle overlay */}
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08)_0%,transparent_60%)]" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  <Icons.check className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-0.5">
                    {problemSection.goodLabel}
                  </div>
                  <h3 className="text-white font-semibold text-base">
                    {problemSection.goodTitle}
                  </h3>
                </div>
              </div>
              <ul className="space-y-3.5">
                {problemSection.goodItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center mt-0.5 shrink-0">
                      <Icons.check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-indigo-100 text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              {/* Result badge */}
              <div className="mt-6 pt-5 border-t border-white/15">
                <p className="text-sm text-indigo-200 italic">
                  {problemSection.resultGood}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom callout */}
        <div className="mt-12 text-center">
          <p className="text-slate-500 text-base max-w-xl mx-auto">
            {problemSection.bottomNote}
          </p>
        </div>
      </div>
    </section>
  );
}
