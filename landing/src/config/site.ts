// ============================================================
// ARQUIVO CENTRAL DE CONFIGURAÇÃO — ProvaMax Landing Page
// Edite aqui para alterar nome, preço, links, textos e listas
// ============================================================

// ── Produto ──────────────────────────────────────────────────
export const APP_NAME = "ProvaMax";
export const APP_PRICE = "49,99";               // Preço exibido
export const APP_CURRENCY = "R$";
export const APP_BILLING_PERIOD = "/mês";        // Periodicidade da cobrança
export const APP_BILLING_LABEL = "Assinatura mensal"; // Texto de periodicidade

// ── Links ────────────────────────────────────────────────────
export const APP_CHECKOUT_URL =
  "https://pay.hotmart.com/J105287549V?off=p6s93xlr&checkoutMode=10"; // Link do checkout Hotmart
export const APP_PLATFORM_URL = "https://prova-max.vercel.app/";       // Link da plataforma

// ── Hero ─────────────────────────────────────────────────────
// headline e headlineAccent formam as duas linhas da headline principal
export const hero = {
  headline: "Treine como",                        // Linha 1 da headline (branca)
  headlineAccent: "a prova cobra.",               // Linha 2 da headline (gradiente)
  subtitle:
    "Questões inéditas no estilo FCC, simulados estratégicos e flashcards de revisão ativa. Um sistema construído para transformar teoria em desempenho real.",
  ctaPrimary: `Garantir meu acesso — ${APP_CURRENCY} ${APP_PRICE}${APP_BILLING_PERIOD}`,
  ctaSecondary: "Como funciona",
  accessNote: "Acesso enviado por e-mail após confirmação na Hotmart",
};

// ── Seção Problema ───────────────────────────────────────────
export const problemSection = {
  eyebrow: "O erro mais comum",
  headline: "Leitura acumula.",                  // Linha 1 do h2
  headlineAccent: "Treino aprova.",              // Linha 2 do h2 (gradiente)
  subtitle:
    "A maioria dos concurseiros passa horas consumindo conteúdo — aulas, resumos, anotações — e pouco tempo aplicando o que aprendeu. Mas prova se ganha na execução, não na leitura.",
  badLabel: "O que a maioria faz",
  badTitle: "Estudar sem executar",
  goodLabel: "O que o ProvaMax propõe",
  goodTitle: "Treinar com método",
  badItems: [
    "Consumir teoria sem praticar questões",
    "Fazer resumos que nunca revisará",
    "Estudar sem saber o que a banca cobra",
    "Ignorar o padrão e o estilo da FCC",
    "Acumular conteúdo sem executar nada",
  ],
  goodItems: [
    "Treinar com questões inéditas no estilo FCC",
    "Revisar com flashcards de forma ativa",
    "Simular condições reais de prova",
    "Identificar e corrigir padrões de erro",
    "Medir e acompanhar sua evolução real",
  ],
  resultBad:
    "Resultado: muito estudo, pouca evolução, sensação de estar ficando para trás.",
  resultGood:
    "Resultado: clareza no que falta, consistência no treino e evolução visível.",
  bottomNote:
    "O ProvaMax foi construído para quem já entendeu isso — e quer parar de acumular teoria e começar a converter estudo em desempenho real.",
};

// ── Benefícios ───────────────────────────────────────────────
export const benefits = [
  {
    icon: "layers",
    title: "+1.000 questões",
    description:
      "Banco extenso e atualizado, construído para cobrir cada ponto do edital com profundidade.",
  },
  {
    icon: "sparkle",
    title: "Questões inéditas",
    description:
      "Conteúdo exclusivo, desenvolvido especificamente para o ProvaMax — não encontrado em outros bancos.",
  },
  {
    icon: "target",
    title: "Padrão FCC",
    description:
      "Questões construídas respeitando a lógica, o estilo e o nível de exigência da banca.",
  },
  {
    icon: "book",
    title: "Edital completo",
    description:
      "Todas as disciplinas e matérias organizadas, estruturadas e acessíveis em um único lugar.",
  },
  {
    icon: "refresh",
    title: "Atualização constante",
    description:
      "O banco de questões é revisado e ampliado continuamente para manter o conteúdo alinhado ao edital.",
  },
  {
    icon: "chart",
    title: "Estatísticas de desempenho",
    description:
      "Veja exatamente onde você está acertando, onde está errando e o que exige mais atenção.",
  },
  {
    icon: "lightning",
    title: "Simulados estratégicos",
    description:
      "Dois modos de simulado — básico e avançado — com lógica de alternância de assuntos.",
  },
  {
    icon: "card",
    title: "Flashcards de revisão",
    description:
      "Revisão ativa com flashcards para fixar conceitos e aumentar sua retenção a longo prazo.",
  },
  {
    icon: "history",
    title: "Histórico de simulados",
    description:
      "Acompanhe sua evolução com registros completos de todos os simulados realizados.",
  },
  {
    icon: "phone",
    title: "Acesso pelo celular",
    description:
      "Plataforma responsiva e otimizada para mobile — treine de qualquer lugar, a qualquer hora.",
  },
  {
    icon: "split",
    title: "Gerais e específicos",
    description:
      "Separação clara entre conhecimentos gerais e específicos, respeitando a estrutura do edital.",
  },
];

// ── Disciplinas cobertas ─────────────────────────────────────
export const disciplines = [
  "Língua Portuguesa",
  "Legislação Institucional",
  "Geografia e História de Roraima",
  "Direito Constitucional",
  "Direito Administrativo",
  "Noções de Administração Financeira e Orçamentária",
  "Noções de Administração Pública",
  "Noções de Processo Legislativo",
  "Noções de Legística",
];

// ── Como funciona ────────────────────────────────────────────
export const howItWorks = [
  {
    step: "01",
    title: "Clique em assinar",
    description:
      "Escolha o ProvaMax e clique no botão para ir ao checkout seguro da Hotmart.",
  },
  {
    step: "02",
    title: "Finalize o pagamento",
    description:
      "Assine mensalmente via cartão de crédito, Pix ou boleto — rápido, seguro e sem complicação.",
  },
  {
    step: "03",
    title: "Receba o acesso",
    description:
      "Após a confirmação, você recebe no e-mail o link da plataforma e as instruções de acesso.",
  },
  {
    step: "04",
    title: "Comece a treinar",
    description:
      "Entre no ProvaMax e inicie seu treino com método, organização e inteligência.",
  },
];

// ── FAQ ──────────────────────────────────────────────────────
export const faqs = [
  {
    question: "O conteúdo cobre todo o edital?",
    answer:
      "Sim. O ProvaMax foi estruturado com base no edital completo, cobrindo todas as disciplinas de conhecimentos gerais e específicos exigidas na prova.",
  },
  {
    question: "As questões são inéditas?",
    answer:
      "Sim. O banco de questões do ProvaMax é composto por questões originais, desenvolvidas exclusivamente para a plataforma, respeitando o estilo e o padrão de cobrança da banca FCC.",
  },
  {
    question: "Tem acesso pelo celular?",
    answer:
      "Sim. A plataforma é completamente responsiva e foi desenvolvida com foco na experiência mobile. Você pode treinar de qualquer lugar, a qualquer hora.",
  },
  {
    question: "Tem simulados?",
    answer:
      "Sim. O ProvaMax oferece dois modos de simulado: básico e avançado. Cada modo tem uma lógica diferente de alternância de assuntos, simulando as condições reais da prova.",
  },
  {
    question: "Tem flashcards?",
    answer:
      "Sim. O sistema de flashcards permite revisão ativa de conceitos, ajudando na retenção do conteúdo e na identificação do que ainda precisa de reforço.",
  },
  {
    question: "Como funciona o acesso?",
    answer:
      "Após a confirmação da assinatura pela Hotmart, você recebe por e-mail o link de acesso à plataforma ProvaMax e as instruções para entrar. O processo é automático.",
  },
  {
    question: "Quando recebo o link da plataforma?",
    answer:
      "O e-mail com o link e as instruções de acesso é enviado automaticamente logo após a confirmação do pagamento — geralmente em poucos minutos.",
  },
  {
    question: "É uma assinatura mensal? Posso cancelar?",
    answer:
      "Sim, o ProvaMax funciona por assinatura mensal. Você pode cancelar a qualquer momento diretamente pela Hotmart, sem multa e sem burocracia. O acesso segue ativo até o fim do período pago.",
  },
  {
    question: "Como funciona o pagamento?",
    answer:
      "O pagamento é processado com segurança pela Hotmart, uma das maiores plataformas de infoprodutos do Brasil. A cobrança é mensal e pode ser feita com cartão de crédito, Pix ou boleto bancário.",
  },
  {
    question: "Preciso pagar antes para entrar?",
    answer:
      "Sim. O acesso ao ProvaMax é liberado exclusivamente após a confirmação da assinatura mensal. A plataforma não é de acesso público.",
  },
];
