// Plano de estudo TOP1 DEFINITIVO v2 — Técnico Legislativo ALE-RR — FCC
// Construído fielmente a partir do PDF PLANO_TOP1_DEFINITIVO_v2_TECNICO_ALE-RR_1.pdf
// NÃO usar este arquivo em runtime para ler o PDF — os dados já estão aqui embutidos.
//
// INÍCIO DO PLANO: 2026-04-01 (use PLAN_START_DATE de studyNowUtils.ts)

export type StudyTaskType = 'questoes' | 'teoria' | 'lei_seca' | 'simulado' | 'revisao'

export type StudyDayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'

export interface StudyTask {
  id: string
  disciplina: string
  assunto: string
  tipo: StudyTaskType
  quantidade?: number
  // Preenchido em runtime pelo studyNowUtils.resolveTaskMapping()
  mappedDisciplineId?: string | null
  mappedSubjectId?: string | null
  mappedPartId?: string | null
  mappedPathLabel?: string | null
  requiresManualSetup?: boolean
  setupHint?: string | null
}

export interface StudyDayPlan {
  semana: number
  dia: StudyDayKey
  tarefas: StudyTask[]
}

// ---------------------------------------------------------------------------
// PLANO COMPLETO — 13 SEMANAS
// Legenda de tipos:
//   questoes  → navegar para /study/:subjectId
//   teoria    → navegar para /theory/:subjectId
//   lei_seca  → leitura da lei, marcar manualmente
//   simulado  → navegar para /simulado
//   revisao   → revisão espaçada / caderno de erros / flashcards
// ---------------------------------------------------------------------------

export const studyPlan: StudyDayPlan[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 1 — Meta: 95q | Acerto: 60%
  // Foco: Lacunas Port + Reg.Int Comissões/Sessões + Org.Estado + CE + DirAdm
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 1, dia: 'seg',
    tarefas: [
      { id: 's1_seg_1', disciplina: 'Português', assunto: 'Ortografia e Acentuação — teoria enxuta', tipo: 'teoria', quantidade: 15 },
      { id: 's1_seg_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Arts. 45-70 — Comissões Permanentes', tipo: 'lei_seca' },
      { id: 's1_seg_3', disciplina: 'Direito Constitucional', assunto: 'Organização do Estado — Arts. 18-36 (LACUNA)', tipo: 'teoria', quantidade: 15 },
      { id: 's1_seg_4', disciplina: 'Português', assunto: 'Bloco C — 50 questões acumuladas', tipo: 'questoes', quantidade: 50 },
    ],
  },
  {
    semana: 1, dia: 'ter',
    tarefas: [
      { id: 's1_ter_1', disciplina: 'Português', assunto: 'Crase — teoria enxuta', tipo: 'teoria' },
      { id: 's1_ter_2', disciplina: 'Direito Administrativo', assunto: 'Atos Administrativos — revisão e classificação', tipo: 'questoes', quantidade: 15 },
      { id: 's1_ter_3', disciplina: 'Legislação Institucional', assunto: 'Constituição Estadual Arts. 30-44 — lei seca', tipo: 'lei_seca', quantidade: 10 },
      { id: 's1_ter_4', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas cronometradas', tipo: 'questoes', quantidade: 25 },
      { id: 's1_ter_5', disciplina: 'Legislação Institucional', assunto: 'Constituição Estadual Arts. 44-67 — lei seca', tipo: 'lei_seca', quantidade: 20 },
    ],
  },
  {
    semana: 1, dia: 'qua',
    tarefas: [
      { id: 's1_qua_1', disciplina: 'Português', assunto: 'Denotação/Conotação e Discurso — teoria enxuta', tipo: 'teoria' },
      { id: 's1_qua_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Arts. 95-115 — Sessões Ordinárias', tipo: 'lei_seca' },
      { id: 's1_qua_3', disciplina: 'Direito Constitucional', assunto: 'Art. 37-41 — Administração Pública consolidação', tipo: 'questoes', quantidade: 10 },
      { id: 's1_qua_4', disciplina: 'Legislação Institucional', assunto: 'Código de Ética Parlamentar — lei seca', tipo: 'lei_seca' },
    ],
  },
  {
    semana: 1, dia: 'qui',
    tarefas: [
      { id: 's1_qui_1', disciplina: 'Português', assunto: 'Figuras de Linguagem e Intertextualidade — teoria', tipo: 'teoria' },
      { id: 's1_qui_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Arts. 115-145 — Processo Legislativo interno', tipo: 'lei_seca' },
      { id: 's1_qui_3', disciplina: 'Processo Legislativo', assunto: 'CF Arts. 44-47 — Poder Legislativo (ENTRADA)', tipo: 'teoria', quantidade: 10 },
      { id: 's1_qui_4', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas cronometradas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 1, dia: 'sex',
    tarefas: [
      { id: 's1_sex_1', disciplina: 'Português', assunto: 'Morfossintaxe e Formação de Palavras — teoria', tipo: 'teoria' },
      { id: 's1_sex_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Arts. 145-175 — Deputados e votação', tipo: 'lei_seca' },
      { id: 's1_sex_3', disciplina: 'Direito Administrativo', assunto: 'Agentes Públicos + LC 053 Arts. 111-116 + Res. 015/24', tipo: 'questoes', quantidade: 20 },
      { id: 's1_sex_4', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas cronometradas', tipo: 'questoes', quantidade: 25 },
      { id: 's1_sex_5', disciplina: 'Geral', assunto: 'Sessão 2 — Simulado temático 50q cronometrado', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 1, dia: 'sab',
    tarefas: [
      { id: 's1_sab_1', disciplina: 'Geografia e História de Roraima', assunto: 'Reativação I — Território, Estado, Governadores', tipo: 'revisao' },
      { id: 's1_sab_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Arts. 175-213 FIM — disposições finais', tipo: 'lei_seca' },
      { id: 's1_sab_3', disciplina: 'Geral', assunto: 'Simulado diagnóstico 50q — define 3 críticos', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 1, dia: 'dom',
    tarefas: [
      { id: 's1_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO — Flashcards e podcast (leve)', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 2 — Meta: 105q | Acerto: 63%
  // Foco: VERBOS/VOZES + ProcLeg CF 48-52 + DirAdm Poderes + Geo/Hist II
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 2, dia: 'seg',
    tarefas: [
      { id: 's2_seg_1', disciplina: 'Português', assunto: 'Verbos — consolidação', tipo: 'questoes', quantidade: 20 },
      { id: 's2_seg_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Mesa Diretora — questões', tipo: 'questoes', quantidade: 15 },
      { id: 's2_seg_3', disciplina: 'Direito Constitucional', assunto: 'Direitos Sociais e Nacionalidade — reativação', tipo: 'questoes', quantidade: 15 },
      { id: 's2_seg_4', disciplina: 'Direito Administrativo', assunto: 'Poderes Administrativos — revisão + Abuso', tipo: 'questoes', quantidade: 15 },
      { id: 's2_seg_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas cronometradas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 2, dia: 'ter',
    tarefas: [
      { id: 's2_ter_1', disciplina: 'Português', assunto: 'Vozes Verbais — motor de questões', tipo: 'questoes', quantidade: 20 },
      { id: 's2_ter_2', disciplina: 'Direito Administrativo', assunto: 'LC 053 — continuação e baterias', tipo: 'questoes', quantidade: 20 },
      { id: 's2_ter_3', disciplina: 'Legislação Institucional', assunto: 'Constituição Estadual — revisão completa', tipo: 'revisao', quantidade: 15 },
      { id: 's2_ter_4', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas cronometradas', tipo: 'questoes', quantidade: 25 },
      { id: 's2_ter_5', disciplina: 'Regimento Interno ALE-RR', assunto: 'Sessão 2 — lei seca + 20q', tipo: 'lei_seca', quantidade: 20 },
    ],
  },
  {
    semana: 2, dia: 'qua',
    tarefas: [
      { id: 's2_qua_1', disciplina: 'Português', assunto: 'Vozes Verbais baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's2_qua_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Sessões — questões', tipo: 'questoes', quantidade: 15 },
      { id: 's2_qua_3', disciplina: 'Processo Legislativo', assunto: 'CF Arts. 48-52 — Atribuições do Congresso', tipo: 'teoria', quantidade: 15 },
    ],
  },
  {
    semana: 2, dia: 'qui',
    tarefas: [
      { id: 's2_qui_1', disciplina: 'Português', assunto: 'Sinonímia e Antonímia — questões diretas', tipo: 'questoes', quantidade: 20 },
      { id: 's2_qui_2', disciplina: 'Direito Constitucional', assunto: 'Art. 37-41 — Administração Pública consolidação', tipo: 'questoes', quantidade: 15 },
      { id: 's2_qui_3', disciplina: 'Geral', assunto: 'Revisão espaçada Semana 1 (D+7)', tipo: 'revisao' },
      { id: 's2_qui_4', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas cronometradas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 2, dia: 'sex',
    tarefas: [
      { id: 's2_sex_1', disciplina: 'Português', assunto: 'Verbos e Vozes — baterias finais', tipo: 'questoes', quantidade: 20 },
      { id: 's2_sex_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Deputados — questões', tipo: 'questoes', quantidade: 15 },
      { id: 's2_sex_3', disciplina: 'Processo Legislativo', assunto: 'CF Arts. 59-69 — CORE teoria + questões', tipo: 'teoria', quantidade: 20 },
      { id: 's2_sex_4', disciplina: 'Legislação Institucional', assunto: 'LC 373/2026 — lei seca', tipo: 'lei_seca', quantidade: 15 },
      { id: 's2_sex_5', disciplina: 'Geral', assunto: 'Sessão 2 — Simulado temático 50q cronometrado', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 2, dia: 'sab',
    tarefas: [
      { id: 's2_sab_1', disciplina: 'Geografia e História de Roraima', assunto: 'Reativação III — Formação territorial e economia', tipo: 'revisao' },
      { id: 's2_sab_2', disciplina: 'Geral', assunto: 'Simulado misto 50q + Caderno de erros', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 2, dia: 'dom',
    tarefas: [
      { id: 's2_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO — Flashcards e podcast', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 3 — Meta: 115q | Acerto: 65%
  // Foco: SINTAXE I+II + ProcLeg 59-69 + Licitação ENTRADA + LC 373
  // FIM FASE 1: se <65% → reforço sem.4
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 3, dia: 'seg',
    tarefas: [
      { id: 's3_seg_1', disciplina: 'Português', assunto: 'Sintaxe I — Objeto Direto/Indireto, baterias', tipo: 'questoes', quantidade: 20 },
      { id: 's3_seg_2', disciplina: 'Direito Constitucional', assunto: 'Organização do Estado — consolidação', tipo: 'questoes', quantidade: 15 },
      { id: 's3_seg_3', disciplina: 'Direito Administrativo', assunto: 'Licitação 14.133 — ENTRADA teoria', tipo: 'teoria', quantidade: 15 },
      { id: 's3_seg_4', disciplina: 'Português', assunto: 'Sessão 2 — 50 questões Port acumuladas', tipo: 'questoes', quantidade: 50 },
      { id: 's3_seg_5', disciplina: 'Regimento Interno ALE-RR', assunto: 'Pré-uni 35min — lei seca', tipo: 'lei_seca' },
    ],
  },
  {
    semana: 3, dia: 'ter',
    tarefas: [
      { id: 's3_ter_1', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias acumuladas Sem 1-2', tipo: 'questoes', quantidade: 20 },
      { id: 's3_ter_2', disciplina: 'Legislação Institucional', assunto: 'LC 373 — continuação lei seca', tipo: 'lei_seca', quantidade: 15 },
      { id: 's3_ter_3', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas cronometradas', tipo: 'questoes', quantidade: 25 },
      { id: 's3_ter_4', disciplina: 'Direito Administrativo', assunto: 'Licitação 14.133 Arts. 1-40 — lei seca', tipo: 'lei_seca', quantidade: 20 },
    ],
  },
  {
    semana: 3, dia: 'qua',
    tarefas: [
      { id: 's3_qua_1', disciplina: 'Português', assunto: 'Sintaxe II — Período Composto', tipo: 'teoria', quantidade: 20 },
      { id: 's3_qua_2', disciplina: 'Processo Legislativo', assunto: 'CF Arts. 59-69 — revisão espaçada (Sem2)', tipo: 'revisao', quantidade: 15 },
      { id: 's3_qua_3', disciplina: 'Regimento Interno ALE-RR', assunto: 'Pré-uni 35min — lei seca', tipo: 'lei_seca' },
    ],
  },
  {
    semana: 3, dia: 'qui',
    tarefas: [
      { id: 's3_qui_1', disciplina: 'Português', assunto: 'Sintaxe II — Orações restritivas vs. explicativas', tipo: 'questoes', quantidade: 20 },
      { id: 's3_qui_2', disciplina: 'Geografia e História de Roraima', assunto: 'Flashcards — reativação', tipo: 'revisao' },
      { id: 's3_qui_3', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas cronometradas', tipo: 'questoes', quantidade: 25 },
      { id: 's3_qui_4', disciplina: 'Processo Legislativo', assunto: 'Sessão 2 — 50q ProcLeg + Const', tipo: 'questoes', quantidade: 50 },
    ],
  },
  {
    semana: 3, dia: 'sex',
    tarefas: [
      { id: 's3_sex_1', disciplina: 'Português', assunto: 'Sintaxe — baterias mistas FCC', tipo: 'questoes', quantidade: 25 },
      { id: 's3_sex_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias — artigos estudados', tipo: 'questoes', quantidade: 15 },
      { id: 's3_sex_3', disciplina: 'Legislação Institucional', assunto: 'Revisão geral CE + Código Ética', tipo: 'revisao', quantidade: 20 },
      { id: 's3_sex_4', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas cronometradas', tipo: 'questoes', quantidade: 30 },
      { id: 's3_sex_5', disciplina: 'Geral', assunto: 'Sessão 2 — Simulado temático 50q cronometrado', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 3, dia: 'sab',
    tarefas: [
      { id: 's3_sab_1', disciplina: 'Geral', assunto: 'Revisão espaçada D+7/D+15 (Sem1 e Sem2)', tipo: 'revisao' },
      { id: 's3_sab_2', disciplina: 'Geral', assunto: 'Simulado 60q — FIM FASE 1 (meta 65%+)', tipo: 'simulado', quantidade: 60 },
    ],
  },
  {
    semana: 3, dia: 'dom',
    tarefas: [
      { id: 's3_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO — Flashcards', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 4 — Meta: 120q | Acerto: 68%
  // Foco: CONCORDÂNCIA + AFO ENTRADA + AdmPub ENTRADA + ProcLeg CE 38-44
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 4, dia: 'seg',
    tarefas: [
      { id: 's4_seg_1', disciplina: 'Português', assunto: 'Concordância Nominal e Verbal — baterias', tipo: 'questoes', quantidade: 25 },
      { id: 's4_seg_2', disciplina: 'Direito Administrativo', assunto: 'Licitação 14.133 — continuação', tipo: 'questoes', quantidade: 20 },
      { id: 's4_seg_3', disciplina: 'Direito Constitucional', assunto: 'Processo Legislativo — consolidação', tipo: 'questoes', quantidade: 15 },
      { id: 's4_seg_4', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas cronometradas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 4, dia: 'ter',
    tarefas: [
      { id: 's4_ter_1', disciplina: 'Português', assunto: 'Concordância — casos especiais (FORTE 40min)', tipo: 'questoes', quantidade: 15 },
      { id: 's4_ter_2', disciplina: 'Legislação Institucional', assunto: 'Constituição Estadual — revisão geral', tipo: 'revisao', quantidade: 15 },
      { id: 's4_ter_3', disciplina: 'Geral', assunto: 'Bloco C — 20 questões mistas cronometradas', tipo: 'questoes', quantidade: 20 },
      { id: 's4_ter_4', disciplina: 'AFO', assunto: 'Sessão 2 — lei seca AFO ENTRADA + 20q', tipo: 'lei_seca', quantidade: 20 },
    ],
  },
  {
    semana: 4, dia: 'qua',
    tarefas: [
      { id: 's4_qua_1', disciplina: 'Português', assunto: 'Concordância — baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's4_qua_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias acumuladas', tipo: 'questoes', quantidade: 15 },
      { id: 's4_qua_3', disciplina: 'Administração Pública', assunto: 'Bloco A — ENTRADA (modelos teóricos, estrutura)', tipo: 'teoria', quantidade: 15 },
      { id: 's4_qua_4', disciplina: 'Processo Legislativo', assunto: 'Constituição Estadual Arts. 38-44', tipo: 'lei_seca', quantidade: 15 },
    ],
  },
  {
    semana: 4, dia: 'qui',
    tarefas: [
      { id: 's4_qui_1', disciplina: 'Português', assunto: 'Concordância — revisão cirúrgica', tipo: 'questoes', quantidade: 20 },
      { id: 's4_qui_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's4_qui_3', disciplina: 'Geral', assunto: 'Revisão espaçada Semana 3 (D+7)', tipo: 'revisao' },
      { id: 's4_qui_4', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas cronometradas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 4, dia: 'sex',
    tarefas: [
      { id: 's4_sex_1', disciplina: 'Português', assunto: 'Baterias mistas — Port Sem 1-4', tipo: 'questoes', quantidade: 25 },
      { id: 's4_sex_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias ALE-RR', tipo: 'questoes', quantidade: 15 },
      { id: 's4_sex_3', disciplina: 'AFO', assunto: 'Classificações receita/despesa — teoria', tipo: 'teoria', quantidade: 15 },
      { id: 's4_sex_4', disciplina: 'Direito Administrativo', assunto: 'Gestão de Contratos — Res. 001 e 004', tipo: 'questoes', quantidade: 15 },
      { id: 's4_sex_5', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas cronometradas', tipo: 'questoes', quantidade: 30 },
      { id: 's4_sex_6', disciplina: 'Geral', assunto: 'Sessão 2 — Simulado 50q cronometrado', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 4, dia: 'sab',
    tarefas: [
      { id: 's4_sab_1', disciplina: 'Geral', assunto: 'Revisão espaçada D+7/D+15/D+30 (Sem 1-3)', tipo: 'revisao' },
      { id: 's4_sab_2', disciplina: 'AFO', assunto: 'Orçamento público — tipos (PPA/LDO/LOA)', tipo: 'teoria', quantidade: 15 },
      { id: 's4_sab_3', disciplina: 'Geral', assunto: 'Simulado 60q + Caderno de erros', tipo: 'simulado', quantidade: 60 },
    ],
  },
  {
    semana: 4, dia: 'dom',
    tarefas: [
      { id: 's4_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 5 — Meta: 125q | Acerto: 70%
  // Foco: PONTUAÇÃO + ARGUMENTAÇÃO ENTRADA + Gestão Contratos + LGPD + AFO créditos + AdmPub gestão
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 5, dia: 'seg',
    tarefas: [
      { id: 's5_seg_1', disciplina: 'Português', assunto: 'Pontuação — baterias intensivas', tipo: 'questoes', quantidade: 20 },
      { id: 's5_seg_2', disciplina: 'Direito Constitucional', assunto: 'Poder Executivo e Judiciário (LACUNA)', tipo: 'teoria', quantidade: 15 },
      { id: 's5_seg_3', disciplina: 'Direito Administrativo', assunto: 'LGPD — teoria e lei seca', tipo: 'teoria', quantidade: 15 },
      { id: 's5_seg_4', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas cronometradas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 5, dia: 'ter',
    tarefas: [
      { id: 's5_ter_1', disciplina: 'Português', assunto: 'Pontuação — teoria e questões', tipo: 'questoes', quantidade: 15 },
      { id: 's5_ter_2', disciplina: 'AFO', assunto: 'Créditos adicionais e ciclo orçamentário', tipo: 'teoria', quantidade: 15 },
      { id: 's5_ter_3', disciplina: 'Administração Pública', assunto: 'Gestão de Pessoas e Ética', tipo: 'teoria', quantidade: 15 },
      { id: 's5_ter_4', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas', tipo: 'questoes', quantidade: 25 },
      { id: 's5_ter_5', disciplina: 'Direito Administrativo', assunto: 'LGPD — lei seca + 20q', tipo: 'lei_seca', quantidade: 20 },
    ],
  },
  {
    semana: 5, dia: 'qua',
    tarefas: [
      { id: 's5_qua_1', disciplina: 'Português', assunto: 'Argumentação — ENTRADA teoria forte', tipo: 'teoria', quantidade: 20 },
      { id: 's5_qua_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias ALE-RR', tipo: 'questoes', quantidade: 15 },
      { id: 's5_qua_3', disciplina: 'Administração Pública', assunto: 'Gestão de processos e qualidade', tipo: 'teoria', quantidade: 15 },
      { id: 's5_qua_4', disciplina: 'Direito Administrativo', assunto: 'Controle Administrativo', tipo: 'teoria', quantidade: 15 },
    ],
  },
  {
    semana: 5, dia: 'qui',
    tarefas: [
      { id: 's5_qui_1', disciplina: 'Português', assunto: 'Argumentação — teoria e questões', tipo: 'teoria', quantidade: 15 },
      { id: 's5_qui_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's5_qui_3', disciplina: 'Direito Administrativo', assunto: 'Responsabilidade Civil do Estado', tipo: 'teoria', quantidade: 15 },
      { id: 's5_qui_4', disciplina: 'Geral', assunto: 'Revisão espaçada Semana 4 (D+7)', tipo: 'revisao' },
      { id: 's5_qui_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 5, dia: 'sex',
    tarefas: [
      { id: 's5_sex_1', disciplina: 'Português', assunto: 'Pontuação + Argumentação — baterias', tipo: 'questoes', quantidade: 25 },
      { id: 's5_sex_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias ALE-RR', tipo: 'questoes', quantidade: 15 },
      { id: 's5_sex_3', disciplina: 'AFO', assunto: 'Baterias — classificações e ciclo', tipo: 'questoes', quantidade: 15 },
      { id: 's5_sex_4', disciplina: 'Administração Pública', assunto: 'Governo eletrônico e indicadores', tipo: 'teoria', quantidade: 15 },
      { id: 's5_sex_5', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas cronometradas', tipo: 'questoes', quantidade: 30 },
      { id: 's5_sex_6', disciplina: 'Geral', assunto: 'Sessão 2 — Simulado 50q FOCO TEMPO', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 5, dia: 'sab',
    tarefas: [
      { id: 's5_sab_1', disciplina: 'Geral', assunto: 'Revisão espaçada D+7/D+15/D+30', tipo: 'revisao' },
      { id: 's5_sab_2', disciplina: 'Geral', assunto: 'Simulado 60q FOCO TEMPO + Caderno top 20', tipo: 'simulado', quantidade: 60 },
    ],
  },
  {
    semana: 5, dia: 'dom',
    tarefas: [
      { id: 's5_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 6 — Meta: 130q | Acerto: 72%
  // Foco: REGÊNCIA + LEGÍSTICA ENTRADA + Const Funções Essenciais + AFO Sistema RR
  // GATILHO GESTOR: ≥72% no sábado → Gestor entra sem.7
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 6, dia: 'seg',
    tarefas: [
      { id: 's6_seg_1', disciplina: 'Português', assunto: 'Regência + Colocação Pronominal — baterias', tipo: 'questoes', quantidade: 20 },
      { id: 's6_seg_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias intensivas', tipo: 'questoes', quantidade: 15 },
      { id: 's6_seg_3', disciplina: 'Direito Constitucional', assunto: 'Funções Essenciais da Justiça', tipo: 'teoria', quantidade: 15 },
      { id: 's6_seg_4', disciplina: 'Direito Administrativo', assunto: 'Baterias consolidação Sem 1-5', tipo: 'questoes', quantidade: 20 },
      { id: 's6_seg_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 6, dia: 'ter',
    tarefas: [
      { id: 's6_ter_1', disciplina: 'Português', assunto: 'Regência e Crase — baterias', tipo: 'questoes', quantidade: 20 },
      { id: 's6_ter_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias provas similares', tipo: 'questoes', quantidade: 15 },
      { id: 's6_ter_3', disciplina: 'Legística', assunto: 'LC 95/98 — ENTRADA teoria + lei seca', tipo: 'lei_seca', quantidade: 20 },
      { id: 's6_ter_4', disciplina: 'AFO', assunto: 'Sistema orçamentário de Roraima', tipo: 'teoria', quantidade: 15 },
      { id: 's6_ter_5', disciplina: 'Geral', assunto: 'Bloco C — 20 questões mistas', tipo: 'questoes', quantidade: 20 },
    ],
  },
  {
    semana: 6, dia: 'qua',
    tarefas: [
      { id: 's6_qua_1', disciplina: 'Português', assunto: 'Vozes Verbais — revisão intensiva', tipo: 'questoes', quantidade: 20 },
      { id: 's6_qua_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's6_qua_3', disciplina: 'Legística', assunto: 'LINDB + Dec. 9.830/19', tipo: 'lei_seca', quantidade: 15 },
      { id: 's6_qua_4', disciplina: 'Administração Pública', assunto: 'Baterias Sem 4-5', tipo: 'questoes', quantidade: 15 },
    ],
  },
  {
    semana: 6, dia: 'qui',
    tarefas: [
      { id: 's6_qui_1', disciplina: 'Português', assunto: 'Baterias integradas Port Sem 1-6', tipo: 'questoes', quantidade: 25 },
      { id: 's6_qui_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's6_qui_3', disciplina: 'Direito Administrativo', assunto: 'Responsabilidade Civil + Controle', tipo: 'questoes', quantidade: 20 },
      { id: 's6_qui_4', disciplina: 'Geral', assunto: 'Revisão espaçada Semana 5 (D+7)', tipo: 'revisao' },
      { id: 's6_qui_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 6, dia: 'sex',
    tarefas: [
      { id: 's6_sex_1', disciplina: 'Português', assunto: 'Argumentação — baterias avançadas', tipo: 'questoes', quantidade: 20 },
      { id: 's6_sex_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias finais Sem 1-6', tipo: 'questoes', quantidade: 15 },
      { id: 's6_sex_3', disciplina: 'Legística', assunto: 'LC 95/98 revisão geral', tipo: 'revisao', quantidade: 15 },
      { id: 's6_sex_4', disciplina: 'AFO', assunto: 'Baterias + AdmPub baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's6_sex_5', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas', tipo: 'questoes', quantidade: 30 },
      { id: 's6_sex_6', disciplina: 'Geral', assunto: 'Sessão 2 — Simulado 50q + Caderno', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 6, dia: 'sab',
    tarefas: [
      { id: 's6_sab_1', disciplina: 'Geral', assunto: 'Revisão espaçada D+7/D+15/D+30', tipo: 'revisao' },
      { id: 's6_sab_2', disciplina: 'Direito Administrativo', assunto: 'Baterias finais Dir. Adm.', tipo: 'questoes', quantidade: 20 },
      { id: 's6_sab_3', disciplina: 'Geral', assunto: 'Simulado 60q — GATILHO GESTOR (meta: 72%+)', tipo: 'simulado', quantidade: 60 },
    ],
  },
  {
    semana: 6, dia: 'dom',
    tarefas: [
      { id: 's6_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 7 — Meta: 135q | Acerto: 74%
  // Foco: REESCRITURA + Legística Dec.12.002 + Const Controle + SIMULADO GATILHO SAB
  // ≥72% → Gestor entra Sem.8 | <72% → atrasa
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 7, dia: 'seg',
    tarefas: [
      { id: 's7_seg_1', disciplina: 'Português', assunto: 'Reescritura de frases — TREINO INTENSIVO', tipo: 'questoes', quantidade: 25 },
      { id: 's7_seg_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias intensivas', tipo: 'questoes', quantidade: 15 },
      { id: 's7_seg_3', disciplina: 'Direito Constitucional', assunto: 'Controle de Constitucionalidade', tipo: 'teoria', quantidade: 20 },
      { id: 's7_seg_4', disciplina: 'Direito Administrativo', assunto: 'Baterias gerais', tipo: 'questoes', quantidade: 15 },
      { id: 's7_seg_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 7, dia: 'ter',
    tarefas: [
      { id: 's7_ter_1', disciplina: 'Português', assunto: 'Reescritura avançada', tipo: 'questoes', quantidade: 20 },
      { id: 's7_ter_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's7_ter_3', disciplina: 'Legística', assunto: 'Dec. 12.002/24 — teoria e lei seca', tipo: 'lei_seca', quantidade: 20 },
      { id: 's7_ter_4', disciplina: 'Administração Pública', assunto: 'Controle social e transparência', tipo: 'teoria', quantidade: 15 },
      { id: 's7_ter_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 7, dia: 'qua',
    tarefas: [
      { id: 's7_qua_1', disciplina: 'Português', assunto: 'Reescritura — baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's7_qua_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's7_qua_3', disciplina: 'AFO', assunto: 'Baterias acumuladas', tipo: 'questoes', quantidade: 15 },
      { id: 's7_qua_4', disciplina: 'Administração Pública', assunto: 'Baterias acumuladas', tipo: 'questoes', quantidade: 15 },
    ],
  },
  {
    semana: 7, dia: 'qui',
    tarefas: [
      { id: 's7_qui_1', disciplina: 'Português', assunto: 'Argumentação avançada — silogismos e falácias', tipo: 'questoes', quantidade: 20 },
      { id: 's7_qui_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's7_qui_3', disciplina: 'Legística', assunto: 'Revisão geral LC 95 + Dec. 9.830 + Dec. 12.002', tipo: 'revisao', quantidade: 15 },
      { id: 's7_qui_4', disciplina: 'Geral', assunto: 'Revisão espaçada Semana 6 (D+7)', tipo: 'revisao' },
      { id: 's7_qui_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 7, dia: 'sex',
    tarefas: [
      { id: 's7_sex_1', disciplina: 'Português', assunto: 'Reescritura + Argumentação — baterias finais', tipo: 'questoes', quantidade: 25 },
      { id: 's7_sex_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's7_sex_3', disciplina: 'Direito Constitucional', assunto: 'Baterias gerais CF', tipo: 'questoes', quantidade: 20 },
      { id: 's7_sex_4', disciplina: 'Processo Legislativo', assunto: 'Baterias cruzadas CF + CE + Regimento', tipo: 'questoes', quantidade: 20 },
      { id: 's7_sex_5', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas', tipo: 'questoes', quantidade: 30 },
      { id: 's7_sex_6', disciplina: 'Geral', assunto: 'Sessão 2 — Simulado 50q + Caderno', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 7, dia: 'sab',
    tarefas: [
      { id: 's7_sab_1', disciplina: 'Geral', assunto: 'SIMULADO GATILHO: 70q Técnico completo 3.5h cronometrado', tipo: 'simulado', quantidade: 70 },
      { id: 's7_sab_2', disciplina: 'Geral', assunto: 'Caderno de erros — análise pós-simulado', tipo: 'revisao' },
    ],
  },
  {
    semana: 7, dia: 'dom',
    tarefas: [
      { id: 's7_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 8 — Meta: 145q | Acerto: 76%
  // Foco: Baterias FCC reais + GESTOR AdmPub expandida + Gestão Governamental
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 8, dia: 'seg',
    tarefas: [
      { id: 's8_seg_1', disciplina: 'Português', assunto: 'BATERIA FCC REAL #1 — nível superior', tipo: 'questoes', quantidade: 25 },
      { id: 's8_seg_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias intensivas', tipo: 'questoes', quantidade: 15 },
      { id: 's8_seg_3', disciplina: 'Direito Constitucional', assunto: 'Baterias reais CF', tipo: 'questoes', quantidade: 20 },
      { id: 's8_seg_4', disciplina: 'Direito Administrativo', assunto: 'Baterias reais DirAdm', tipo: 'questoes', quantidade: 20 },
      { id: 's8_seg_5', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas', tipo: 'questoes', quantidade: 30 },
    ],
  },
  {
    semana: 8, dia: 'ter',
    tarefas: [
      { id: 's8_ter_1', disciplina: 'Português', assunto: 'Baterias FCC + Port nível TRT/SEFAZ', tipo: 'questoes', quantidade: 20 },
      { id: 's8_ter_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's8_ter_3', disciplina: 'AFO', assunto: 'Baterias acumuladas', tipo: 'questoes', quantidade: 15 },
      { id: 's8_ter_4', disciplina: 'Administração Pública', assunto: 'GESTOR: Adm. Pública expandida 90min', tipo: 'teoria', quantidade: 20 },
      { id: 's8_ter_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 8, dia: 'qua',
    tarefas: [
      { id: 's8_qua_1', disciplina: 'Português', assunto: 'Reescritura avançada FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's8_qua_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's8_qua_3', disciplina: 'Administração Pública', assunto: 'GESTOR: Gestão Governamental — BSC e indicadores', tipo: 'teoria', quantidade: 15 },
    ],
  },
  {
    semana: 8, dia: 'qui',
    tarefas: [
      { id: 's8_qui_1', disciplina: 'Português', assunto: 'Argumentação — revisão final', tipo: 'questoes', quantidade: 20 },
      { id: 's8_qui_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's8_qui_3', disciplina: 'Legística', assunto: 'Revisão LC 95 + LINDB', tipo: 'revisao', quantidade: 15 },
      { id: 's8_qui_4', disciplina: 'Administração Pública', assunto: 'Baterias + GESTOR Gestão Gov continuação', tipo: 'questoes', quantidade: 20 },
      { id: 's8_qui_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões Técnico+Gestor', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 8, dia: 'sex',
    tarefas: [
      { id: 's8_sex_1', disciplina: 'Português', assunto: 'Baterias FCC reais', tipo: 'questoes', quantidade: 20 },
      { id: 's8_sex_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's8_sex_3', disciplina: 'Direito Administrativo', assunto: 'Consolidação geral DirAdm', tipo: 'questoes', quantidade: 20 },
      { id: 's8_sex_4', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas', tipo: 'questoes', quantidade: 30 },
      { id: 's8_sex_5', disciplina: 'Geral', assunto: 'Sessão 2 — Simulado 50q + Caderno', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 8, dia: 'sab',
    tarefas: [
      { id: 's8_sab_1', disciplina: 'Geral', assunto: 'Revisão espaçada + GESTOR continuação', tipo: 'revisao' },
      { id: 's8_sab_2', disciplina: 'Geral', assunto: 'Simulado Técnico 70q + Caderno de erros', tipo: 'simulado', quantidade: 70 },
    ],
  },
  {
    semana: 8, dia: 'dom',
    tarefas: [
      { id: 's8_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 9 — Meta: 155q | Acerto: 78%
  // Foco: SIMULADO TÉCNICO 80q + Gestor Adm. Geral ENTRADA
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 9, dia: 'seg',
    tarefas: [
      { id: 's9_seg_1', disciplina: 'Português', assunto: 'BATERIA FCC REAL #2', tipo: 'questoes', quantidade: 25 },
      { id: 's9_seg_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's9_seg_3', disciplina: 'Direito Constitucional', assunto: 'Baterias CF + súmulas', tipo: 'questoes', quantidade: 20 },
      { id: 's9_seg_4', disciplina: 'Direito Administrativo', assunto: 'Baterias DirAdm + súmulas', tipo: 'questoes', quantidade: 20 },
      { id: 's9_seg_5', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas', tipo: 'questoes', quantidade: 30 },
    ],
  },
  {
    semana: 9, dia: 'ter',
    tarefas: [
      { id: 's9_ter_1', disciplina: 'Português', assunto: 'Baterias FCC nível ALE', tipo: 'questoes', quantidade: 20 },
      { id: 's9_ter_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's9_ter_3', disciplina: 'Legística', assunto: 'Baterias Legística', tipo: 'questoes', quantidade: 15 },
      { id: 's9_ter_4', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas', tipo: 'questoes', quantidade: 25 },
      { id: 's9_ter_5', disciplina: 'Administração Pública', assunto: 'GESTOR: Adm. Geral baterias + 30q', tipo: 'questoes', quantidade: 30 },
    ],
  },
  {
    semana: 9, dia: 'qua',
    tarefas: [
      { id: 's9_qua_1', disciplina: 'Português', assunto: 'Baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's9_qua_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's9_qua_3', disciplina: 'Administração Pública', assunto: 'GESTOR: Adm. Geral — teorias clássicas e RH', tipo: 'teoria', quantidade: 20 },
    ],
  },
  {
    semana: 9, dia: 'qui',
    tarefas: [
      { id: 's9_qui_1', disciplina: 'Português', assunto: 'Baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's9_qui_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's9_qui_3', disciplina: 'AFO', assunto: 'Baterias + AdmPub baterias', tipo: 'questoes', quantidade: 20 },
      { id: 's9_qui_4', disciplina: 'Administração Pública', assunto: 'GESTOR: baterias Adm. Geral', tipo: 'questoes', quantidade: 20 },
      { id: 's9_qui_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 9, dia: 'sex',
    tarefas: [
      { id: 's9_sex_1', disciplina: 'Português', assunto: 'Baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's9_sex_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's9_sex_3', disciplina: 'Administração Pública', assunto: 'GESTOR: Gestão Governamental — consolidação', tipo: 'questoes', quantidade: 20 },
      { id: 's9_sex_4', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas', tipo: 'questoes', quantidade: 30 },
      { id: 's9_sex_5', disciplina: 'Geral', assunto: 'Sessão 2 — Simulado 50q + Caderno', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 9, dia: 'sab',
    tarefas: [
      { id: 's9_sab_1', disciplina: 'Geral', assunto: 'SIMULADO TÉCNICO 80q — meta 78%+', tipo: 'simulado', quantidade: 80 },
      { id: 's9_sab_2', disciplina: 'Geral', assunto: 'Correção + Caderno top 15', tipo: 'revisao' },
    ],
  },
  {
    semana: 9, dia: 'dom',
    tarefas: [
      { id: 's9_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 10 — Meta: 160q | Acerto: 80%
  // Foco: Simulado #2 + Gestor consolidação + 1ª REDAÇÃO
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 10, dia: 'seg',
    tarefas: [
      { id: 's10_seg_1', disciplina: 'Português', assunto: 'Revisão cirúrgica — erros dos simulados', tipo: 'revisao', quantidade: 20 },
      { id: 's10_seg_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Flash lei seca', tipo: 'lei_seca' },
      { id: 's10_seg_3', disciplina: 'Direito Constitucional', assunto: 'Baterias finais CF', tipo: 'questoes', quantidade: 20 },
      { id: 's10_seg_4', disciplina: 'Direito Administrativo', assunto: 'Baterias finais DirAdm', tipo: 'questoes', quantidade: 20 },
      { id: 's10_seg_5', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas', tipo: 'questoes', quantidade: 30 },
    ],
  },
  {
    semana: 10, dia: 'ter',
    tarefas: [
      { id: 's10_ter_1', disciplina: 'Português', assunto: 'Baterias FCC + 1ª REDAÇÃO', tipo: 'questoes', quantidade: 20 },
      { id: 's10_ter_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's10_ter_3', disciplina: 'Administração Pública', assunto: 'Adm. Geral — baterias Gestor', tipo: 'questoes', quantidade: 20 },
      { id: 's10_ter_4', disciplina: 'Geral', assunto: 'GESTOR: baterias gerais 30q', tipo: 'questoes', quantidade: 30 },
    ],
  },
  {
    semana: 10, dia: 'qua',
    tarefas: [
      { id: 's10_qua_1', disciplina: 'Português', assunto: 'Baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's10_qua_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Flash baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's10_qua_3', disciplina: 'Administração Pública', assunto: 'GESTOR: baterias + AFO revisão', tipo: 'questoes', quantidade: 20 },
    ],
  },
  {
    semana: 10, dia: 'qui',
    tarefas: [
      { id: 's10_qui_1', disciplina: 'Português', assunto: 'Baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's10_qui_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's10_qui_3', disciplina: 'AFO', assunto: 'Flash geral AFO + AdmPub + Legística', tipo: 'revisao', quantidade: 15 },
      { id: 's10_qui_4', disciplina: 'Legislação Institucional', assunto: 'GESTOR: Resoluções Legislativas', tipo: 'lei_seca', quantidade: 15 },
      { id: 's10_qui_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões mistas', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 10, dia: 'sex',
    tarefas: [
      { id: 's10_sex_1', disciplina: 'Português', assunto: 'Baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's10_sex_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's10_sex_3', disciplina: 'Administração Pública', assunto: 'GESTOR: baterias + DirAdm flash', tipo: 'questoes', quantidade: 20 },
      { id: 's10_sex_4', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas', tipo: 'questoes', quantidade: 30 },
      { id: 's10_sex_5', disciplina: 'Geral', assunto: 'Sessão 2 — Simulado 50q + Caderno', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 10, dia: 'sab',
    tarefas: [
      { id: 's10_sab_1', disciplina: 'Geral', assunto: 'SIMULADO TÉCNICO #2 — 80q meta 80%+', tipo: 'simulado', quantidade: 80 },
      { id: 's10_sab_2', disciplina: 'Geral', assunto: 'Correção + ajuste estratégia', tipo: 'revisao' },
    ],
  },
  {
    semana: 10, dia: 'dom',
    tarefas: [
      { id: 's10_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 11 — Meta: 165q | Acerto: 82%
  // Foco: Gestor consolidação total + 2ª REDAÇÃO + SIMULADO INTEGRADO SAB
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 11, dia: 'seg',
    tarefas: [
      { id: 's11_seg_1', disciplina: 'Português', assunto: 'Baterias finais FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's11_seg_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Flash lei seca', tipo: 'lei_seca' },
      { id: 's11_seg_3', disciplina: 'Direito Constitucional', assunto: 'Baterias CF + Legística revisão', tipo: 'questoes', quantidade: 20 },
      { id: 's11_seg_4', disciplina: 'Direito Administrativo', assunto: 'Baterias DirAdm', tipo: 'questoes', quantidade: 20 },
      { id: 's11_seg_5', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas', tipo: 'questoes', quantidade: 30 },
    ],
  },
  {
    semana: 11, dia: 'ter',
    tarefas: [
      { id: 's11_ter_1', disciplina: 'Português', assunto: 'Baterias FCC + 2ª REDAÇÃO', tipo: 'questoes', quantidade: 20 },
      { id: 's11_ter_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's11_ter_3', disciplina: 'Administração Pública', assunto: 'GESTOR: consolidação total', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 11, dia: 'qua',
    tarefas: [
      { id: 's11_qua_1', disciplina: 'Português', assunto: 'Flash baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's11_qua_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Flash baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's11_qua_3', disciplina: 'Legislação Institucional', assunto: 'LC 373 revisão + AFO flash', tipo: 'revisao', quantidade: 15 },
    ],
  },
  {
    semana: 11, dia: 'qui',
    tarefas: [
      { id: 's11_qui_1', disciplina: 'Português', assunto: 'Baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's11_qui_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's11_qui_3', disciplina: 'Administração Pública', assunto: 'GESTOR: baterias finais', tipo: 'questoes', quantidade: 20 },
      { id: 's11_qui_4', disciplina: 'Processo Legislativo', assunto: 'Revisão geral ProcLeg CF + CE', tipo: 'revisao', quantidade: 15 },
      { id: 's11_qui_5', disciplina: 'Geral', assunto: 'Bloco C — 25 questões Técnico+Gestor', tipo: 'questoes', quantidade: 25 },
    ],
  },
  {
    semana: 11, dia: 'sex',
    tarefas: [
      { id: 's11_sex_1', disciplina: 'Português', assunto: 'Baterias FCC', tipo: 'questoes', quantidade: 20 },
      { id: 's11_sex_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Baterias', tipo: 'questoes', quantidade: 15 },
      { id: 's11_sex_3', disciplina: 'Geral', assunto: 'Revisão geral Técnico + Gestor flash', tipo: 'revisao', quantidade: 20 },
      { id: 's11_sex_4', disciplina: 'Geral', assunto: 'Bloco C — 30 questões mistas', tipo: 'questoes', quantidade: 30 },
      { id: 's11_sex_5', disciplina: 'Geral', assunto: 'Sessão 2 — Simulado 50q + Caderno', tipo: 'simulado', quantidade: 50 },
    ],
  },
  {
    semana: 11, dia: 'sab',
    tarefas: [
      { id: 's11_sab_1', disciplina: 'Geral', assunto: 'SIMULADO INTEGRADO MANHÃ: Técnico 80q', tipo: 'simulado', quantidade: 80 },
      { id: 's11_sab_2', disciplina: 'Geral', assunto: 'SIMULADO INTEGRADO TARDE: Gestor 80q', tipo: 'simulado', quantidade: 80 },
      { id: 's11_sab_3', disciplina: 'Geral', assunto: 'Correção + críticos finais — DIA D', tipo: 'revisao' },
    ],
  },
  {
    semana: 11, dia: 'dom',
    tarefas: [
      { id: 's11_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 12 — Meta: 140q | Acerto: 83%
  // ZERO conteúdo novo — Revisão final — Simulado Final META 85%+
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 12, dia: 'seg',
    tarefas: [
      { id: 's12_seg_1', disciplina: 'Português', assunto: 'Revisão final cirúrgica — erros críticos', tipo: 'revisao', quantidade: 15 },
      { id: 's12_seg_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Flash lei seca final', tipo: 'lei_seca' },
      { id: 's12_seg_3', disciplina: 'Direito Constitucional', assunto: 'Revisão artigos-chave CF', tipo: 'revisao', quantidade: 15 },
      { id: 's12_seg_4', disciplina: 'Direito Administrativo', assunto: 'Revisão artigos-chave DirAdm', tipo: 'revisao', quantidade: 15 },
      { id: 's12_seg_5', disciplina: 'Geral', assunto: 'Bloco C — 20 questões mistas', tipo: 'questoes', quantidade: 20 },
    ],
  },
  {
    semana: 12, dia: 'ter',
    tarefas: [
      { id: 's12_ter_1', disciplina: 'Português', assunto: 'Flash baterias Port', tipo: 'questoes', quantidade: 20 },
      { id: 's12_ter_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Flash lei seca', tipo: 'lei_seca' },
      { id: 's12_ter_3', disciplina: 'Administração Pública', assunto: 'GESTOR: revisão flash + 30q', tipo: 'revisao', quantidade: 30 },
      { id: 's12_ter_4', disciplina: 'Geral', assunto: 'Lei seca flash geral', tipo: 'lei_seca' },
    ],
  },
  {
    semana: 12, dia: 'qua',
    tarefas: [
      { id: 's12_qua_1', disciplina: 'Português', assunto: 'Flash leve Port', tipo: 'questoes', quantidade: 15 },
      { id: 's12_qua_2', disciplina: 'Regimento Interno ALE-RR', assunto: 'Flash lei seca', tipo: 'lei_seca' },
      { id: 's12_qua_3', disciplina: 'AFO', assunto: 'Flash AFO + AdmPub + Legística', tipo: 'revisao', quantidade: 15 },
    ],
  },
  {
    semana: 12, dia: 'qui',
    tarefas: [
      { id: 's12_qui_1', disciplina: 'Português', assunto: 'Flash Port + Reg.Int', tipo: 'questoes', quantidade: 15 },
      { id: 's12_qui_2', disciplina: 'Administração Pública', assunto: 'GESTOR: baterias finais + ProcLeg revisão', tipo: 'questoes', quantidade: 15 },
      { id: 's12_qui_3', disciplina: 'Geral', assunto: 'Bloco C — 20 questões mistas leve', tipo: 'questoes', quantidade: 20 },
    ],
  },
  {
    semana: 12, dia: 'sex',
    tarefas: [
      { id: 's12_sex_1', disciplina: 'Português', assunto: 'Flash Port + Reg.Int leve', tipo: 'questoes', quantidade: 15 },
      { id: 's12_sex_2', disciplina: 'Geral', assunto: 'Revisão geral flash — 20 questões', tipo: 'revisao', quantidade: 20 },
      { id: 's12_sex_3', disciplina: 'Geral', assunto: 'DESCANSO — sem carga pesada', tipo: 'revisao' },
    ],
  },
  {
    semana: 12, dia: 'sab',
    tarefas: [
      { id: 's12_sab_1', disciplina: 'Geral', assunto: 'SIMULADO FINAL TÉCNICO 80q — META 85%+', tipo: 'simulado', quantidade: 80 },
      { id: 's12_sab_2', disciplina: 'Geral', assunto: 'Correção leve + Descanso ativo', tipo: 'revisao' },
    ],
  },
  {
    semana: 12, dia: 'dom',
    tarefas: [
      { id: 's12_dom_1', disciplina: 'Geral', assunto: 'DESCANSO OBRIGATÓRIO', tipo: 'revisao' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANA 13 — Meta: 80q | Acerto: 85%
  // Carga DECRESCENTE → DESCANSO → PROVA 28/06
  // ═══════════════════════════════════════════════════════════════════════

  {
    semana: 13, dia: 'seg',
    tarefas: [
      { id: 's13_seg_1', disciplina: 'Português', assunto: 'Flash 20q + Reg.Int flash', tipo: 'questoes', quantidade: 20 },
      { id: 's13_seg_2', disciplina: 'Geral', assunto: 'Simulado leve 40q + Caderno top 10', tipo: 'simulado', quantidade: 40 },
    ],
  },
  {
    semana: 13, dia: 'ter',
    tarefas: [
      { id: 's13_ter_1', disciplina: 'Direito Constitucional', assunto: 'Flash CF 15q', tipo: 'questoes', quantidade: 15 },
      { id: 's13_ter_2', disciplina: 'Legislação Institucional', assunto: 'Flash Legis.Inst 15q', tipo: 'questoes', quantidade: 15 },
      { id: 's13_ter_3', disciplina: 'Administração Pública', assunto: 'GESTOR: flash 30q', tipo: 'questoes', quantidade: 30 },
    ],
  },
  {
    semana: 13, dia: 'qua',
    tarefas: [
      { id: 's13_qua_1', disciplina: 'Direito Administrativo', assunto: 'Flash DirAdm 15q', tipo: 'questoes', quantidade: 15 },
      { id: 's13_qua_2', disciplina: 'AFO', assunto: 'Flash AFO 15q', tipo: 'questoes', quantidade: 15 },
      { id: 's13_qua_3', disciplina: 'Regimento Interno ALE-RR', assunto: 'ÚLTIMA revisão lei seca — 20min', tipo: 'lei_seca' },
    ],
  },
  {
    semana: 13, dia: 'qui',
    tarefas: [
      { id: 's13_qui_1', disciplina: 'Geral', assunto: 'DESCANSO — sem estudo', tipo: 'revisao' },
    ],
  },
  {
    semana: 13, dia: 'sex',
    tarefas: [
      { id: 's13_sex_1', disciplina: 'Geral', assunto: 'DESCANSO TOTAL — zero estudo', tipo: 'revisao' },
    ],
  },
  {
    semana: 13, dia: 'sab',
    tarefas: [
      { id: 's13_sab_1', disciplina: 'Geral', assunto: 'VÉSPERA: 30min MAX — 20 gatilhos de memória', tipo: 'revisao' },
    ],
  },
  {
    semana: 13, dia: 'dom',
    tarefas: [
      { id: 's13_dom_1', disciplina: 'Geral', assunto: '🎯 PROVA MANHÃ: TÉCNICO 80q (4h)', tipo: 'simulado', quantidade: 80 },
      { id: 's13_dom_2', disciplina: 'Geral', assunto: '🎯 PROVA TARDE: GESTOR 80q + Redação (5h)', tipo: 'simulado', quantidade: 80 },
    ],
  },
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getDayPlan(semana: number, dia: StudyDayKey): StudyDayPlan | undefined {
  return studyPlan.find(p => p.semana === semana && p.dia === dia)
}

export const DAY_LABELS: Record<StudyDayKey, string> = {
  seg: 'Segunda-feira',
  ter: 'Terça-feira',
  qua: 'Quarta-feira',
  qui: 'Quinta-feira',
  sex: 'Sexta-feira',
  sab: 'Sábado',
  dom: 'Domingo',
}

export const TASK_TYPE_LABELS: Record<StudyTaskType, string> = {
  questoes: 'Questões',
  teoria: 'Teoria',
  lei_seca: 'Lei Seca',
  simulado: 'Simulado',
  revisao: 'Revisão',
}

export const TASK_TYPE_COLORS: Record<StudyTaskType, string> = {
  questoes: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  teoria: 'bg-violet-500/10 text-violet-700 border-violet-500/20',
  lei_seca: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  simulado: 'bg-red-500/10 text-red-700 border-red-500/20',
  revisao: 'bg-green-500/10 text-green-700 border-green-500/20',
}
