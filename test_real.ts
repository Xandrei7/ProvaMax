import { parseQuestionsText } from './src/lib/parser.ts'
import assert from 'node:assert/strict'

function normalize(rawText: string): string {
  let text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/([^\n\s])([a-eA-E][.)]\s)/g, '$1\n$2')
    .trim()

  const hasProperAlternatives = /^[a-eA-E][.)]\s/m.test(text)
  const isCollapsed = !hasProperAlternatives && /[A-E][a-z\u00C0-\u00FF]{2,}.*?[B-E][a-z\u00C0-\u00FF]{2,}/.test(text)
  if (isCollapsed) {
    text = text.replace(/([A-E])([a-z\u00C0-\u00FF]{2,})/g, '\n$1) $2')
  }

  return text
    .replace(/\n{2,}/g, '\n\n')
    .replace(/(\n|^)([ \t]+)(\d+[.)]\s+)/g, '$1$3')
    // CORRIGIDO: [^ \n0-9] exclui dígitos do trigger para não quebrar "2025)" em "2"+"025)"
    .replace(/([^ \n0-9])(\d+[.)]\s+[A-Z])/g, '$1\n$2')
    .replace(/([^\n])(GABARITO\s*COMENTADO)/i, '$1\n\n$2')
    .replace(/(GABARITO\s*COMENTADO)([^\n])/i, '$1\n\n$2')
    .replace(/([^\n\s])([a-eA-E]\)\s)/g, '$1\n$2')
}

type Case = {
  name: string
  rawText: string
  runAssertions: (parsed: ReturnType<typeof parseQuestionsText>) => void
}

const cases: Case[] = [
  {
    name: 'I, II, III no enunciado + alternativas com ponto',
    rawText: `1. Considerando as afirmativas I, II e III sobre governança pública, assinale a alternativa correta.
I. A transparência é princípio aplicável à Administração Pública.
II. Accountability envolve dever de prestação de contas.
III. A eficiência é princípio aplicável à atuação administrativa.
A. Apenas I e II estão corretas.
B. I, II e III estão corretas.
C. Apenas II e III estão corretas.
D. Apenas III está correta.
E. Nenhuma está correta.

GABARITO COMENTADO

1. B
Comentário da questão 1.`,
    runAssertions: (parsed) => {
      assert.equal(parsed.length, 1)
      assert.equal(parsed[0].number, 1)
      assert.equal(parsed[0].correctAnswer, 'B')
      assert.equal(parsed[0].options?.length, 5)
      assert.match(parsed[0].statement, /I, II e III/)
      assert.equal(parsed[0].type, 'multiple_choice')
    },
  },
  {
    name: 'Formato antigo comum (2, 3, 10)',
    rawText: `2. (FCC – CGM-SP – Auditor de Controle Interno – 2025)
No que concerne aos preceitos de governança aplicáveis à Administração Pública, o conceito de accountability diz respeito à dimensão
a) estritamente política das ações públicas.
b) da cultura organizacional presente nos diversos ambientes internos.
c) relativa ao dever dos agentes públicos de prestar contas.
d) contábil e orçamentário-financeira da atuação estatal.
e) gerencial, sendo aplicado para assegurar que o gestor público esteja alinhado.

3. (FCC – Prefeitura de São Paulo-SP – Analista – 2025)
A Administração Pública contemporânea, forjada a partir do modelo gerencial e informada pelos princípios constitucionais a ela aplicáveis, notadamente o da eficiência, positivado a partir da Emenda Constitucional nº 19, de 1998, deve pautar sua atuação.
a) transparência e accountability representam as duas faces da governança pública.
b) exige-se que a transparência seja ativa, ou seja, que todos os atos sejam publicados.
c) as boas práticas de governança correspondem a conceito que se aplica às empresas estatais.
d) a dimensão denominada accountability diz respeito à exigência de se prestar contas.
e) enquanto a governança responde à dimensão política da atuação administrativa.

10. (FCC – CETESB – Advogado - 2024)
Entre os pilares das boas práticas de governança insere-se o conceito de accountability, que
a) se materializa por meio de mecanismos para que os gestores prestem contas.
b) corresponde à segregação das funções de gestão, fiscalização, monitoramento.
c) significa gestão de riscos, o que inclui mecanismos de identificação.
d) constitui um princípio contábil que demanda, com base no dever de prudência.
e) corresponde à boa-fé objetiva, razão pela qual deve-se presumir.

GABARITO COMENTADO

2. C
GABARITO: C

3. D
GABARITO: D

10. A
GABARITO: A`,
    runAssertions: (parsed) => {
      assert.equal(parsed.length, 3)
      assert.deepEqual(parsed.map(q => q.number), [2, 3, 10])
      assert.deepEqual(parsed.map(q => q.correctAnswer), ['C', 'D', 'A'])
      assert.ok(parsed.every(q => q.options?.length === 5))
    },
  },
  {
    name: 'Múltiplas questões em sequência (1, 2, 3)',
    rawText: `1. A Administração Pública deve observar os princípios constitucionais.
a) Legalidade.
b) Publicidade.
c) Eficiência.
d) Moralidade.
e) Todas as anteriores.

2. Accountability no setor público está relacionada ao dever de
a) prestar contas.
b) editar leis.
c) realizar licitações privadas.
d) extinguir controles.
e) afastar transparência.

3. Governança pública envolve mecanismos de liderança, estratégia e
a) controle.
b) improviso.
c) sigilo absoluto.
d) personalismo.
e) exclusão social.

GABARITO COMENTADO

1. E
2. A
3. A`,
    runAssertions: (parsed) => {
      assert.equal(parsed.length, 3)
      assert.deepEqual(parsed.map(q => q.number), [1, 2, 3])
      assert.deepEqual(parsed.map(q => q.correctAnswer), ['E', 'A', 'A'])
      assert.ok(parsed.every(q => q.type === 'multiple_choice'))
    },
  },
  {
    name: 'Gabarito inline com comentários longos por questão',
    rawText: `1. Sobre o regime jurídico de licitações, assinale a alternativa correta.
a) A lei de licitações não se aplica a contratos administrativos.
b) A lei de licitações disciplina contratações da Administração Pública direta.
c) A lei de licitações revogou totalmente normas constitucionais.
d) A lei de licitações trata apenas de operações de crédito.
e) Nenhuma das alternativas.

2. Em relação às exceções do regime de licitações, assinale a alternativa correta.
a) Operação de crédito sempre exige licitação comum.
b) Gestão de dívida pública sempre depende de pregão eletrônico.
c) Contrato bancário comum não tem tratamento legal específico.
d) Operação de crédito e gestão da dívida pública não seguem, em regra, o rito comum da Lei 14.133.
e) Nenhuma das alternativas.

GABARITO COMENTADO
1. B (Art. 1º, I e II, e § 1º) Afirmativas I e III estão corretas. A II está errada porque empresas públicas e sociedades de economia mista, em regra, não são abrangidas por esta lei, pois se submetem à Lei nº 13.303/2016. Exemplo da vida real: a ALE-RR, quando contrata limpeza ou compra computadores, segue a Lei nº 14.133/2021. ou 2. D (Art. 3º, I) Operação de crédito e gestão da dívida pública não se subordinam ao regime da Lei nº 14.133/2021. Exemplo da vida real: quando o Estado busca um financiamento bancário para captar recursos para obras ou investimentos, isso não é tratado como licitação comum de compra ou serviço.`,
    runAssertions: (parsed) => {
      assert.equal(parsed.length, 2)
      assert.deepEqual(parsed.map(q => q.number), [1, 2])
      assert.deepEqual(parsed.map(q => q.correctAnswer), ['B', 'D'])
      assert.match(parsed[0].comment, /^\(Art\. 1º, I e II, e § 1º\)/)
      assert.match(parsed[1].comment, /^\(Art\. 3º, I\)/)
    },
  },
  {
    name: 'texto_associado: antes de Q1, entre Q8→Q9, entre Q19→Q20',
    rawText: `<u>Atenção: Para responder à questão 1, baseie-se no texto seguinte.</u>
[O Tempo]
Era uma vez um texto muito longo sobre o tempo que passou e voltou e passou de novo.
(Adaptado de: Autor Fictício, Obra Fictícia, 2023.)

1. Sobre o texto acima, assinale a alternativa correta.
a) O tempo não existe.
b) O tempo é relativo.
c) O tempo é absoluto.
d) O tempo é estático.
e) Nenhuma das alternativas.

2. Questão sem texto associado, apenas enunciado simples.
a) Alternativa A.
b) Alternativa B.
c) Alternativa C.
d) Alternativa D.
e) Alternativa E.

8. Última questão antes do segundo bloco de texto.
a) Alternativa A.
b) Alternativa B.
c) Alternativa C.
d) Alternativa D.
e) Alternativa E.

<u>Atenção: Considere a crônica a seguir para responder à questão 9.</u>
[A Crônica]
Era uma vez uma crônica muito especial sobre a vida cotidiana nas cidades brasileiras.
(Adaptado de: Escritor Famoso, Crônicas do Brasil, 2022.)

9. Com base na crônica acima, assinale a alternativa correta.
a) Alternativa A.
b) Alternativa B.
c) Alternativa C.
d) Alternativa D.
e) Alternativa E.

10. Questão sem texto associado logo após Q9.
a) Alternativa A.
b) Alternativa B.
c) Alternativa C.
d) Alternativa D.
e) Alternativa E.

19. Penúltima questão antes do terceiro bloco de texto.
a) Alternativa A.
b) Alternativa B.
c) Alternativa C.
d) Alternativa D.
e) Alternativa E.

<u>Atenção: Baseie-se no poema a seguir para responder à questão 20.</u>
[O Poema]
Era uma vez um poema sobre flores e rios e montanhas cobertas de neve.
(Adaptado de: Poeta Clássico, Antologia Brasileira, 2021.)

20. Com base no poema acima, assinale a alternativa correta.
a) Alternativa A.
b) Alternativa B.
c) Alternativa C.
d) Alternativa D.
e) Alternativa E.

GABARITO COMENTADO

1. B
2. C
8. D
9. A
10. E
19. B
20. C`,
    runAssertions: (parsed) => {
      assert.equal(parsed.length, 7)
      const byNum = Object.fromEntries(parsed.map(q => [q.number, q]))

      assert.ok(byNum[1].associatedText, 'Q1 deve ter texto associado')
      assert.match(byNum[1].associatedText!, /Aten[çc][aã]o/i)
      assert.match(byNum[1].associatedText!, /O Tempo/)

      assert.equal(byNum[2].associatedText, null, 'Q2 não deve ter texto associado')
      assert.equal(byNum[8].associatedText, null, 'Q8 não deve ter texto associado')

      assert.ok(byNum[9].associatedText, 'Q9 deve ter texto associado')
      assert.match(byNum[9].associatedText!, /Aten[çc][aã]o/i)
      assert.match(byNum[9].associatedText!, /A Cr[ôo]nica/)

      assert.equal(byNum[10].associatedText, null, 'Q10 não deve ter texto associado')
      assert.equal(byNum[19].associatedText, null, 'Q19 não deve ter texto associado')

      assert.ok(byNum[20].associatedText, 'Q20 deve ter texto associado')
      assert.match(byNum[20].associatedText!, /Aten[çc][aã]o/i)
      assert.match(byNum[20].associatedText!, /O Poema/)
    },
  },
  {
    name: 'Gabarito compacto sem quebra (inclui questões > 9)',
    rawText: `9. Sobre o tema, assinale a alternativa correta.
a) Item incorreto.
b) Item incorreto.
c) Item incorreto.
d) Item incorreto.
e) Item correto.

10. Sobre o tema 10, assinale a alternativa correta.
a) Item incorreto.
b) Item correto.
c) Item incorreto.
d) Item incorreto.
e) Item incorreto.

11. Sobre o tema 11, assinale a alternativa correta.
a) Item incorreto.
b) Item incorreto.
c) Item correto.
d) Item incorreto.
e) Item incorreto.

GABARITOS COMENTADOS9. E (Comentário Q9).10. B (Comentário Q10).11. C (Comentário Q11).`,
    runAssertions: (parsed) => {
      assert.equal(parsed.length, 3)
      assert.deepEqual(parsed.map(q => q.number), [9, 10, 11])
      assert.deepEqual(parsed.map(q => q.correctAnswer), ['E', 'B', 'C'])
      assert.match(parsed[1].comment, /^\(Comentário Q10\)/)
    },
  },
]

let failures = 0

for (const testCase of cases) {
  try {
    const norm = normalize(testCase.rawText)
    const parsed = parseQuestionsText(norm)
    testCase.runAssertions(parsed)
    console.log(`[OK] ${testCase.name}`)
  } catch (error) {
    failures += 1
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[FALHOU] ${testCase.name}`)
    console.error(message)
  }
}

if (failures > 0) {
  console.error(`\nTOTAL FALHAS: ${failures}`)
  process.exit(1)
}

console.log('\nTODOS TESTES PASSARAM')
