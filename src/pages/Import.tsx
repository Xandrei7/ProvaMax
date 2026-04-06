import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, CheckCircle2, XCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { parseQuestionsText, type ParsedQuestion } from '@/lib/parser'
import { getDisciplines, getSubjects } from '@/lib/dataService'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Discipline } from '@/types'

export function Import() {
  const navigate = useNavigate()
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [disciplineName, setDisciplineName] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedQuestion[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  useEffect(() => {
    getDisciplines().then(setDisciplines)
  }, [])

  function handleParse() {
    if (!disciplineName.trim()) return toast.error('Informe o nome da Matéria.')
    if (!subjectName.trim()) return toast.error('Informe o nome do Assunto.')
    if (!rawText.trim()) return toast.error('Cole as questões no campo de texto.')

    const questions = parseQuestionsText(rawText)

    if (questions.length === 0) {
      return toast.error(
        'Nenhuma questão encontrada. Verifique se o texto está no formato correto:\n"1.\nEnunciado\na) opção\nb) opção\n...\nGABARITO COMENTADO\n1. C\nComentário..."'
      )
    }

    const semGabarito = questions.filter(q => !q.correctAnswer)
    if (semGabarito.length > 0) {
      toast.warning(
        `${semGabarito.length} questão(ões) sem gabarito identificado. Verifique o formato do GABARITO COMENTADO.`
      )
    }

    setParsed(questions)
    toast.success(`${questions.length} questões identificadas! Confira e clique em Importar.`)
  }

  async function handleSave() {
    if (!parsed || !disciplineName.trim() || !subjectName.trim()) return
    setSaving(true)

    try {
      // 1. Discipline: find existing or create
      let discId: string
      const existingDisc = disciplines.find(
        d => d.name.trim().toLowerCase() === disciplineName.trim().toLowerCase()
      )

      if (existingDisc) {
        discId = existingDisc.id
      } else {
        const { data, error } = await supabase
          .from('disciplines')
          .insert({ name: disciplineName.trim(), icon: '📖' })
          .select('id')
          .single()
        if (error) throw error
        discId = data.id
      }

      // 2. Subject: find existing in this discipline or create
      const existingSubs = await getSubjects(discId)
      const existingSub = existingSubs.find(
        s => s.name.trim().toLowerCase() === subjectName.trim().toLowerCase()
      )

      let subId: string
      if (existingSub) {
        subId = existingSub.id
      } else {
        const { data, error } = await supabase
          .from('subjects')
          .insert({
            name: subjectName.trim(),
            discipline_id: discId,
            sort_order: existingSubs.length + 1,
          })
          .select('id')
          .single()
        if (error) throw error
        subId = data.id
      }

      // 3. Insert questions
      const rows = parsed.map((q, i) => ({
        statement: q.statement,
        type: q.type,
        options: q.type === 'multiple_choice' ? q.options : null,
        correct_answer: q.correctAnswer || 'C',
        comment: q.comment || '',
        legal_basis: null,
        exam_tips: null,
        subject_id: subId,
        discipline_id: discId,
        sort_order: i + 1,
      }))

      const { error } = await supabase.from('questions').insert(rows)
      if (error) throw error

      toast.success(`${parsed.length} questões importadas com sucesso!`)
      navigate('/')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setParsed(null)
    setExpandedIdx(null)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Importar Questões" showBack />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-10">

        {!parsed ? (
          /* ── STEP 1: paste ── */
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-3">1. Informe a Matéria e o Assunto</p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Matéria {disciplines.length > 0 && '(existentes: ' + disciplines.map(d => d.name).join(', ') + ')'}
                  </label>
                  <input
                    list="disciplines-list"
                    value={disciplineName}
                    onChange={e => setDisciplineName(e.target.value)}
                    placeholder="Ex: Lei nº 963/2014"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <datalist id="disciplines-list">
                    {disciplines.map(d => <option key={d.id} value={d.name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Assunto</label>
                  <input
                    value={subjectName}
                    onChange={e => setSubjectName(e.target.value)}
                    placeholder="Ex: Punições Disciplinares"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-1">2. Cole aqui as questões + gabarito comentado</p>
              <p className="text-xs text-muted-foreground mb-3">
                Formato esperado: questões numeradas com alternativas a) b) c)... seguidas de{' '}
                <strong>GABARITO COMENTADO</strong> com as respostas e explicações.
              </p>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                rows={16}
                placeholder={`1.\n\nEnunciado da primeira questão...\n\na) alternativa A\nb) alternativa B\nc) alternativa C\nd) alternativa D\ne) alternativa E\n\n2.\n\nEnunciado da segunda questão...\n\na) ...\n\nGABARITO COMENTADO\n1. C\n\nComentário explicando a resposta...\n\n2. A\n\nComentário explicando a resposta...`}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              onClick={handleParse}
              disabled={!disciplineName || !subjectName || !rawText}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <Upload size={16} />
              Identificar questões
            </button>
          </div>
        ) : (
          /* ── STEP 2: preview + confirm ── */
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900/50 p-4">
              <p className="font-semibold text-green-700 dark:text-green-400">
                {parsed.length} questões identificadas
              </p>
              <p className="text-sm text-green-600/80 dark:text-green-400/70">
                Matéria: <strong>{disciplineName}</strong> · Assunto: <strong>{subjectName}</strong>
              </p>
            </div>

            {/* Preview list */}
            <div className="flex flex-col gap-2">
              {parsed.map((q, i) => (
                <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/30"
                  >
                    <span className={cn(
                      'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold',
                      q.type === 'true_false'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-primary/10 text-primary'
                    )}>
                      {q.type === 'true_false' ? 'C/E' : 'MC'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{q.statement || <span className="text-red-500 italic">⚠ Enunciado não detectado</span>}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {q.correctAnswer ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 size={12} /> Gabarito: {q.correctAnswer}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-500">
                            <XCircle size={12} /> Sem gabarito
                          </span>
                        )}
                        {q.comment && (
                          <span className="text-xs text-muted-foreground">· Com comentário</span>
                        )}
                      </div>
                    </div>
                    {expandedIdx === i ? <ChevronUp size={14} className="shrink-0 mt-1 text-muted-foreground" /> : <ChevronDown size={14} className="shrink-0 mt-1 text-muted-foreground" />}
                  </button>

                  {expandedIdx === i && (
                    <div className="border-t border-border px-4 py-3 flex flex-col gap-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">ENUNCIADO</p>
                        <p>{q.statement}</p>
                      </div>
                      {q.options && q.options.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">ALTERNATIVAS</p>
                          <div className="flex flex-col gap-1">
                            {q.options.map(opt => (
                              <div key={opt.letter} className={cn(
                                'rounded-md px-3 py-1.5 text-sm',
                                opt.letter === q.correctAnswer
                                  ? 'bg-green-50 text-green-700 font-medium dark:bg-green-950/30 dark:text-green-400'
                                  : 'bg-muted/50'
                              )}>
                                <span className="font-bold mr-2">{opt.letter}.</span>{opt.text}
                                {opt.letter === q.correctAnswer && ' ✓'}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {q.comment && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">COMENTÁRIO</p>
                          <p className="text-muted-foreground leading-relaxed">{q.comment}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={reset}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium hover:bg-muted/50"
              >
                Editar texto
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? (
                  <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                ) : (
                  <><CheckCircle2 size={16} /> Confirmar importação</>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
