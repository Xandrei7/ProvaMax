-- ============================================================
-- IMPORTAR QUESTÕES — Lei nº 963/2014 | Punições Disciplinares
-- Cole no SQL Editor do Supabase e clique em Run
-- ============================================================

DO $$
DECLARE
  disc_id uuid;
  subj_id uuid;
BEGIN

  -- 1. Criar a Matéria
  INSERT INTO public.disciplines (name, icon)
  VALUES ('Lei nº 963/2014', '⚖️')
  RETURNING id INTO disc_id;

  -- 2. Criar o Assunto
  INSERT INTO public.subjects (name, discipline_id, sort_order)
  VALUES ('Punições Disciplinares', disc_id, 1)
  RETURNING id INTO subj_id;

  -- ── QUESTÃO 1 ──────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'Nos termos da Lei nº 963/2014, as punições disciplinares, em ordem crescente de gravidade, são:',
    'multiple_choice',
    '[
      {"letter":"A","text":"advertência, repreensão, permanência disciplinar, detenção disciplinar, reforma administrativa disciplinar, demissão e licenciamento a bem da disciplina."},
      {"letter":"B","text":"advertência, repreensão, detenção disciplinar, permanência disciplinar, reforma administrativa disciplinar, licenciamento/exclusão a bem da disciplina para praças e demissão para oficiais."},
      {"letter":"C","text":"advertência, repreensão, permanência disciplinar, detenção disciplinar, reforma administrativa disciplinar, licenciamento e exclusão a bem da disciplina para praças com ou sem estabilidade, e demissão para oficiais."},
      {"letter":"D","text":"advertência, permanência disciplinar, repreensão, detenção disciplinar, reforma administrativa disciplinar, exclusão a bem da disciplina e demissão."},
      {"letter":"E","text":"advertência, repreensão, permanência disciplinar, reforma administrativa disciplinar, detenção disciplinar, licenciamento/exclusão e demissão."}
    ]'::jsonb,
    'C',
    'A ordem crescente é: advertência → repreensão → permanência disciplinar → detenção disciplinar → reforma administrativa disciplinar → licenciamento e exclusão a bem da disciplina (praças) → demissão (oficiais). A IDECAN gosta de trocar a posição de permanência e detenção ou de separar licenciamento e exclusão como se fossem categorias independentes fora do mesmo inciso.',
    subj_id, disc_id, 1
  );

  -- ── QUESTÃO 2 ──────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'A advertência, segundo a Lei nº 963/2014, é:',
    'multiple_choice',
    '[
      {"letter":"A","text":"punição escrita, publicada em boletim, aplicável às faltas leves."},
      {"letter":"B","text":"forma mais branda de punir, aplicada verbalmente, podendo ser particular ou ostensiva, devendo ser registrada na ficha disciplinar do transgressor."},
      {"letter":"C","text":"punição verbal, não registrada, destinada apenas às faltas culposas."},
      {"letter":"D","text":"punição verbal, aplicada somente de forma reservada, vedada sua realização de forma ostensiva."},
      {"letter":"E","text":"punição escrita, de caráter pedagógico, que não altera o comportamento do militar e pode ser aplicada a faltas leves e médias."}
    ]'::jsonb,
    'B',
    'A advertência é a forma mais branda de punir, aplicada verbalmente, podendo ser particular ou ostensiva, e deve ser registrada na ficha disciplinar do transgressor. A pegadinha está em trocar "verbal" por "escrita" ou dizer que não há registro.',
    subj_id, disc_id, 2
  );

  -- ── QUESTÃO 3 ──────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'A repreensão é corretamente definida como:',
    'multiple_choice',
    '[
      {"letter":"A","text":"punição verbal aplicada às faltas leves e médias, sem publicação em boletim."},
      {"letter":"B","text":"punição escrita e reservada, aplicável exclusivamente às faltas médias."},
      {"letter":"C","text":"punição feita por escrito e publicada em Boletim Geral da Corporação, sem privar o punido da liberdade, aplicável às faltas leves e médias."},
      {"letter":"D","text":"punição publicada em boletim, que priva parcialmente a liberdade, aplicável às faltas médias e graves."},
      {"letter":"E","text":"punição escrita, não publicada, cabível apenas quando houver reincidência específica."}
    ]'::jsonb,
    'C',
    'A repreensão é escrita, publicada em Boletim Geral da Corporação, não priva a liberdade e é aplicável às faltas leves e médias. O examinador costuma trocar "leve e média" por "somente média" ou inverter com "verbal".',
    subj_id, disc_id, 3
  );

  -- ── QUESTÃO 4 ──────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'Sobre a permanência disciplinar, assinale a alternativa correta:',
    'multiple_choice',
    '[
      {"letter":"A","text":"consiste no confinamento do militar em cela disciplinar, sem participação em qualquer ato de instrução."},
      {"letter":"B","text":"consiste no cerceamento da liberdade do punido, que deve permanecer nas dependências da unidade, sem ficar confinado, comparecendo a todos os atos de instrução e serviços."},
      {"letter":"C","text":"consiste na retenção do militar, no âmbito da Organização Militar, sem participar de quaisquer serviços ou atividades."},
      {"letter":"D","text":"somente pode ser cumprida na residência do punido."},
      {"letter":"E","text":"é cabível exclusivamente para transgressões graves."}
    ]'::jsonb,
    'B',
    'Permanência disciplinar = cerceamento da liberdade, permanência nas dependências da unidade, SEM confinamento, comparecendo a todos os atos de instrução e serviços. Atenção: a alternativa C descreve a detenção disciplinar, não a permanência — troca clássica de banca.',
    subj_id, disc_id, 4
  );

  -- ── QUESTÃO 5 ──────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'Quanto à detenção disciplinar, é correto afirmar que:',
    'multiple_choice',
    '[
      {"letter":"A","text":"pode ser aplicada a transgressões leves, desde que o militar seja reincidente específico."},
      {"letter":"B","text":"consiste em retenção do militar no âmbito da Organização Militar, sem participar de quaisquer serviços ou atividades, e somente pode ser aplicada em transgressão de natureza grave."},
      {"letter":"C","text":"pode ser aplicada a faltas médias e graves, a critério da autoridade competente."},
      {"letter":"D","text":"seus dias contam normalmente como tempo arregimentado."},
      {"letter":"E","text":"se a OM não dispuser de local apropriado, a detenção será automaticamente convertida em advertência."}
    ]'::jsonb,
    'B',
    'Detenção disciplinar = retenção do militar no âmbito da OM, sem participar de quaisquer serviços ou atividades, aplicável SOMENTE a transgressão grave. É comum a banca trocar permanência por detenção ou ampliar o cabimento para faltas médias.',
    subj_id, disc_id, 5
  );

  -- ── QUESTÃO 6 ──────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'De acordo com a Lei nº 963/2014, os dias em que o militar permanecer em detenção disciplinar:',
    'multiple_choice',
    '[
      {"letter":"A","text":"contam como tempo arregimentado apenas se houver autorização do Comandante-Geral."},
      {"letter":"B","text":"contam pela metade como tempo arregimentado."},
      {"letter":"C","text":"não contam como tempo arregimentado."},
      {"letter":"D","text":"contam normalmente, salvo se houver reincidência."},
      {"letter":"E","text":"não contam apenas para fins de promoção por merecimento."}
    ]'::jsonb,
    'C',
    'Literalidade da lei: os dias de detenção disciplinar NÃO contam como tempo arregimentado. Questão seca de letra de lei — decora o verbo.',
    subj_id, disc_id, 6
  );

  -- ── QUESTÃO 7 ──────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'A reforma administrativa disciplinar, no sistema da Lei nº 963/2014, é:',
    'multiple_choice',
    '[
      {"letter":"A","text":"punição cabível tanto para oficiais quanto para praças, com ou sem estabilidade."},
      {"letter":"B","text":"penalidade exclusivamente judicial, dependente de sentença penal militar transitada em julgado."},
      {"letter":"C","text":"sanção disciplinar prevista em ordem crescente de gravidade, mas que não integra o rol das punições disciplinares."},
      {"letter":"D","text":"punição disciplinar prevista entre a detenção disciplinar e o licenciamento/exclusão a bem da disciplina."},
      {"letter":"E","text":"medida cautelar, e não punição definitiva."}
    ]'::jsonb,
    'D',
    'A reforma administrativa disciplinar integra o rol das punições e aparece entre a detenção disciplinar e o licenciamento/exclusão a bem da disciplina. A IDECAN pode tentar empurrar que ela é só consequência previdenciária, mas ela é também punição disciplinar no código.',
    subj_id, disc_id, 7
  );

  -- ── QUESTÃO 8 ──────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'Segundo a regra de competência para punir disciplinarmente, assinale a alternativa correta:',
    'multiple_choice',
    '[
      {"letter":"A","text":"o Comandante-Geral pode aplicar todas as sanções disciplinares, inclusive demissão e reforma administrativa disciplinar de oficiais."},
      {"letter":"B","text":"o Governador do Estado é competente para aplicar todas as sanções disciplinares previstas na lei, após o devido processo legal, aos militares estaduais ativos e aos da reserva remunerada."},
      {"letter":"C","text":"o Chefe da Casa Militar da Governadoria pode aplicar qualquer sanção prevista na lei aos militares sob seu comando."},
      {"letter":"D","text":"o Subcomandante-Geral pode aplicar, inclusive, demissão de oficiais e exclusão a bem da disciplina de praças."},
      {"letter":"E","text":"os Comandantes de Pelotão podem aplicar advertência, repreensão, permanência disciplinar e detenção disciplinar dentro dos limites legais."}
    ]'::jsonb,
    'B',
    'O Governador do Estado pode aplicar todas as sanções previstas na lei, após o devido processo legal, aos militares ativos e da reserva remunerada. Já o Comandante-Geral NÃO pode aplicar demissão nem reforma administrativa disciplinar de oficiais — essa competência é do Governador.',
    subj_id, disc_id, 8
  );

  -- ── QUESTÃO 9 ──────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'Quanto à modificação da punição disciplinar, a lei prevê que:',
    'multiple_choice',
    '[
      {"letter":"A","text":"somente a autoridade superior pode modificar a punição aplicada."},
      {"letter":"B","text":"a modificação pode ser realizada pela autoridade que aplicou a punição ou por outra superior e competente, motivadamente, quando tiver conhecimento de fatos que recomendem tal procedimento."},
      {"letter":"C","text":"a modificação se limita à revisão e à anulação."},
      {"letter":"D","text":"a conversão depende sempre de recurso prévio."},
      {"letter":"E","text":"a agravação é obrigatória quando houver recurso do punido improvido."}
    ]'::jsonb,
    'B',
    'A modificação pode ser feita pela autoridade que aplicou ou por outra superior e competente, desde que motivadamente, quando tiver conhecimento de fatos que recomendem tal procedimento. A pegadinha clássica é dizer que só a autoridade superior pode fazê-lo.',
    subj_id, disc_id, 9
  );

  -- ── QUESTÃO 10 ─────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'São modalidades de modificação da aplicação de punição disciplinar:',
    'multiple_choice',
    '[
      {"letter":"A","text":"revisão, anulação, retratação e conversão."},
      {"letter":"B","text":"conversão, atenuação, agravação e revisão."},
      {"letter":"C","text":"conversão, revisão, anulação e recurso hierárquico."},
      {"letter":"D","text":"reconsideração, revisão, conversão e agravação."},
      {"letter":"E","text":"revisão, agravação, anulação e pedido de reexame."}
    ]'::jsonb,
    'B',
    'As quatro modalidades de modificação são: CONVERSÃO, ATENUAÇÃO, AGRAVAÇÃO e REVISÃO. Anulação não entra como modificação — ela está em capítulo próprio. Recurso hierárquico também não é modalidade de modificação.',
    subj_id, disc_id, 10
  );

  -- ── QUESTÃO 11 ─────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'A conversão da permanência disciplinar em prestação de serviço operacional poderá ocorrer, a pedido do transgressor, desde que, entre outros requisitos:',
    'multiple_choice',
    '[
      {"letter":"A","text":"ele não seja reincidente específico, esteja no mínimo no comportamento \"ótimo\" e não haja preponderância de agravantes na dosimetria da sanção disciplinar."},
      {"letter":"B","text":"esteja, no mínimo, no comportamento \"bom\" e a transgressão não seja grave."},
      {"letter":"C","text":"a autoridade superior à que aplicou a punição concorde expressamente, ainda que não haja publicação em boletim."},
      {"letter":"D","text":"seja primário e esteja no comportamento, no mínimo, \"bom\"."},
      {"letter":"E","text":"a permanência disciplinar seja superior a 10 dias."}
    ]'::jsonb,
    'A',
    'Para conversão da permanência disciplinar, a lei exige, entre outros: não ser reincidente específico, estar no mínimo no comportamento "ÓTIMO" e não haver preponderância de agravantes. A IDECAN gosta de trocar "ótimo" por "bom" — cuidado com essa pegadinha!',
    subj_id, disc_id, 11
  );

  -- ── QUESTÃO 12 ─────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'Sobre a conversão da permanência disciplinar, assinale a alternativa correta:',
    'multiple_choice',
    '[
      {"letter":"A","text":"um turno de prestação de serviço operacional equivale ao cumprimento de um dia de permanência disciplinar."},
      {"letter":"B","text":"o limite de tempo para a conversão é de até 10 turnos."},
      {"letter":"C","text":"o prazo para o encaminhamento do pedido de conversão é de 5 dias úteis, contados da publicação."},
      {"letter":"D","text":"o pedido de conversão elide o recurso administrativo."},
      {"letter":"E","text":"na hipótese de conversão, a classificação do comportamento do militar passa a ser feita com base na sanção convertida."}
    ]'::jsonb,
    'D',
    'O pedido de conversão ELIDE o recurso administrativo — esse é o ponto mais cobrado. Complemento dos outros dados: 1 turno equivale a 2 dias de permanência; o prazo do pedido é de 3 dias; o limite é de 15 turnos; e a classificação do comportamento continua baseada na sanção originária, não na convertida.',
    subj_id, disc_id, 12
  );

  -- ── QUESTÃO 13 ─────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'A atenuação da punição consiste:',
    'multiple_choice',
    '[
      {"letter":"A","text":"na redução automática da sanção quando houver recurso."},
      {"letter":"B","text":"na diminuição ou transformação da punição proposta ou aplicada em outra menos rigorosa, se assim exigir o interesse da disciplina e da ação educativa do punido, respeitados os limites mínimos legais."},
      {"letter":"C","text":"na exclusão dos efeitos da punição após o cumprimento da metade da sanção."},
      {"letter":"D","text":"na substituição obrigatória da detenção disciplinar por permanência disciplinar."},
      {"letter":"E","text":"em faculdade exclusiva do Governador do Estado."}
    ]'::jsonb,
    'B',
    'A atenuação é a diminuição ou transformação da punição em outra menos rigorosa, quando o interesse da disciplina e da ação educativa assim exigirem, respeitados os limites mínimos legais. Não é automática e não é exclusiva do Governador.',
    subj_id, disc_id, 13
  );

  -- ── QUESTÃO 14 ─────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'Conforme a Lei nº 963/2014, a agravação da punição:',
    'multiple_choice',
    '[
      {"letter":"A","text":"pode ocorrer como consequência da interposição de recurso disciplinar pelo punido."},
      {"letter":"B","text":"consiste no aumento ou transformação da punição em outra mais rigorosa, se assim exigir o interesse da disciplina, respeitados os limites mínimos legais, sendo vedado o agravamento em razão da interposição de recurso disciplinar."},
      {"letter":"C","text":"é cabível apenas na hipótese de reincidência específica."},
      {"letter":"D","text":"depende de autorização judicial."},
      {"letter":"E","text":"não pode transformar a punição em outra mais rigorosa, apenas aumentar sua duração."}
    ]'::jsonb,
    'B',
    'A agravação é o aumento ou transformação da sanção em outra mais rigorosa, mas É VEDADO o agravamento em razão da mera interposição de recurso disciplinar — esse ponto é pegadinha clássica. A alternativa A é exatamente o erro que a banca quer que você cometa.',
    subj_id, disc_id, 14
  );

  -- ── QUESTÃO 15 ─────────────────────────────────────────────
  INSERT INTO public.questions (statement, type, options, correct_answer, comment, subject_id, discipline_id, sort_order)
  VALUES (
    'No tocante aos recursos disciplinares, assinale a alternativa correta:',
    'multiple_choice',
    '[
      {"letter":"A","text":"da decisão que aplicar sanção disciplinar caberá recurso à autoridade superior, sem efeito suspensivo, no prazo de 10 dias úteis."},
      {"letter":"B","text":"da decisão que aplicar sanção disciplinar caberá recurso à autoridade imediatamente superior, com efeito suspensivo, no prazo de 5 dias úteis contados da ciência pessoal do punido, ainda que não haja publicação."},
      {"letter":"C","text":"da decisão que aplicar sanção disciplinar caberá recurso à autoridade superior, com efeito suspensivo, no prazo de 5 dias úteis, contados a partir do primeiro dia útil posterior ao da publicação do ato ou decisão administrativa."},
      {"letter":"D","text":"o recurso disciplinar será dirigido diretamente à Corregedoria."},
      {"letter":"E","text":"a autoridade que aplicou a sanção não pode reconsiderar sua decisão."}
    ]'::jsonb,
    'C',
    'Do recurso disciplinar: cabe à autoridade superior, COM efeito suspensivo, prazo de 5 dias úteis contados do 1º dia útil POSTERIOR à publicação do ato. A autoridade que aplicou pode reconsiderar em 5 dias úteis; se não o fizer, encaminha à superior. A alternativa B erra ao dizer "ciência pessoal" em vez de "publicação".',
    subj_id, disc_id, 15
  );

END $$;
