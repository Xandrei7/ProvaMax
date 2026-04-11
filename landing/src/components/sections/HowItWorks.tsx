import { howItWorks } from "@/config/site";
import { CTAButton } from "@/components/ui/CTAButton";
import { Icons } from "@/components/Icons";

const stepIcons = [
  // Click to buy
  <svg key="buy" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>,
  // Payment
  <svg key="pay" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>,
  // Email
  <svg key="email" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>,
  // Start training
  <svg key="train" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>,
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-white py-24 sm:py-32 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 text-indigo-600 text-sm font-semibold uppercase tracking-wider mb-5">
            <span className="w-8 h-px bg-indigo-400" />
            Como funciona
            <span className="w-8 h-px bg-indigo-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight mb-5">
            Do pagamento ao treino{" "}
            <span className="gradient-text-indigo">em minutos.</span>
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            O processo é simples e direto. Você compra, recebe o acesso por e-mail e já pode começar a treinar.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, index) => (
              <div key={step.step} className="relative flex flex-col items-center text-center">
                {/* Step number + icon */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-indigo-50 border-2 border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                    {stepIcons[index]}
                  </div>
                  <div className="absolute -top-3 -right-3 w-7 h-7 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    {index + 1}
                  </div>
                </div>

                <h3 className="text-slate-900 font-bold text-base mb-2">
                  {step.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Email access callout */}
        <div className="mt-16 bg-indigo-50 border border-indigo-100 rounded-2xl p-8 max-w-2xl mx-auto text-center">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Icons.mail className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="text-slate-900 font-bold text-lg mb-2">
            Acesso enviado automaticamente por e-mail
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            Após a confirmação do pagamento na Hotmart, você recebe no e-mail cadastrado o link de acesso à plataforma e as instruções completas para entrar. Sem espera, sem processo manual.
          </p>
          <CTAButton variant="primary" size="md">
            Comprar e receber acesso
            <Icons.arrowRight className="w-4 h-4" />
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
