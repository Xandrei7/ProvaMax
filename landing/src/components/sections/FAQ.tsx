"use client";

import { useState } from "react";
import { faqs } from "@/config/site";
import { Icons } from "@/components/Icons";

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden transition-all duration-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-slate-50 transition-colors duration-150"
        aria-expanded={open}
      >
        <span className="font-semibold text-slate-800 text-base leading-snug">
          {question}
        </span>
        <span
          className={[
            "shrink-0 text-indigo-600 transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
        >
          <Icons.chevronDown className="w-5 h-5" />
        </span>
      </button>

      <div
        className={[
          "overflow-hidden transition-all duration-300 ease-in-out",
          open ? "max-h-96" : "max-h-0",
        ].join(" ")}
      >
        <div className="px-6 pb-5 border-t border-slate-100">
          <p className="text-slate-600 text-sm leading-relaxed pt-4">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-indigo-600 text-sm font-semibold uppercase tracking-wider mb-5">
            <span className="w-8 h-px bg-indigo-400" />
            Perguntas frequentes
            <span className="w-8 h-px bg-indigo-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-5">
            Ficou alguma{" "}
            <span className="gradient-text-indigo">dúvida?</span>
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            As perguntas mais comuns sobre o ProvaMax, respondidas com clareza.
          </p>
        </div>

        {/* FAQ list */}
        <div className="space-y-3">
          {faqs.map((faq) => (
            <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-12 text-center">
          <p className="text-slate-500 text-sm">
            Ainda tem dúvidas? O acesso é liberado por e-mail após a confirmação do pagamento na Hotmart.
          </p>
        </div>
      </div>
    </section>
  );
}
