import { useEffect, useState } from 'react'
import { extractEmphasisFromHtml } from '@/lib/richText'
import { Plus, Pencil, Trash2, Check, X, Users, BookOpen, FileText, AlertTriangle, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import {
  getDisciplines, saveDiscipline, deleteDiscipline,
  getSubjects, saveSubject, deleteSubject,
  getQuestions, saveQuestion, deleteQuestion,
  getProfiles, updateUserStatus, getReports, ADMIN_EMAIL, normalizeEmail, getUserActivityCounts,
} from '@/lib/dataService'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Discipline, Subject, Question, Profile, QuestionType } from '@/types'

type Tab = 'disciplines' | 'subjects' | 'questions' | 'users' | 'reports'

export function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>('disciplines')
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activityCounts, setActivityCounts] = useState<Record<string, { today: number; week: number; month: number; total: number }>>({})
  const [reports, setReports] = useState<{id:string;question_id:string;user_id:string;message:string;created_at:string}[]>([])

  // Forms
  const [discForm, setDiscForm] = useState<{ id?: string; name: string; icon: string; group_name: string } | null>(null)
  const [subForm, setSubForm] = useState<{ id?: string; name: string; discipline_id: string; sort_order: string } | null>(null)
  // ── Questions tab: filters / sort / selection ─────────────────────────────
  const [qSearch, setQSearch] = useState('')
  const [qFilterDisc, setQFilterDisc] = useState('')
  const [qFilterSubject, setQFilterSubject] = useState('')
  const [qFilterType, setQFilterType] = useState<'' | QuestionType>('')
  const [qSort, setQSort] = useState<'recent' | 'discipline' | 'subject' | 'order'>('recent')
  const [selectedQIds, setSelectedQIds] = useState<Set<string>>(new Set())
  const [pendingOrder, setPendingOrder] = useState<Map<string, number> | null>(null)
  const [showInlineSub, setShowInlineSub] = useState(false)
  const [inlineSubName, setInlineSubName] = useState('')

  const [qForm, setQForm] = useState<{
    id?: string; discipline_id: string; subject_id: string;
    type: QuestionType; statement: string; options: {letter:string;text:string}[];
    correct_answer: string; comment: string; legal_basis: string; exam_tips: string; sort_order: string;
    associated_text: string;
  } | null>(null)

  function formatDateTime(value?: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString('pt-BR')
  }

  const profileStats = {
    total: profiles.length,
    approved: profiles.filter((p) => p.status === 'approved').length,
    pending: profiles.filter((p) => p.status === 'pending').length,
    suspended: profiles.filter((p) => p.status === 'suspended').length,
    revoked: profiles.filter((p) => p.status === 'revoked').length,
  }

  async function refreshProfiles() {
    const p = await getProfiles()
    setProfiles(p)
  }

  async function handleUserStatusChange(userId: string, newStatus: 'pending' | 'approved' | 'suspended' | 'revoked', toastMessage: string) {
    const updated = await updateUserStatus(userId, newStatus)
    setProfiles((prev) => prev.map((profile) => (profile.user_id === userId ? updated : profile)))
    toast.success(toastMessage)
    void refreshProfiles()
  }

  const loadAll = async () => {
    const [d, s, q, p, r, ac] = await Promise.all([getDisciplines(), getSubjects(), getQuestions(), getProfiles(), getReports(), getUserActivityCounts()])
    setDisciplines(d); setSubjects(s); setQuestions(q); setProfiles(p); setReports(r); setActivityCounts(ac)
  }

  useEffect(() => { loadAll() }, [])

  // ── Disciplines ────────────────────────────────────────────────────────────
  async function handleSaveDisc() {
    if (!discForm?.name.trim()) return toast.error('Nome obrigatório')
    try {
      await saveDiscipline({ id: discForm.id, name: discForm.name, icon: discForm.icon || '📚', group_name: discForm.group_name || null })
      toast.success(discForm.id ? 'Matéria atualizada!' : 'Matéria criada!')
      setDiscForm(null); await loadAll()
    } catch { toast.error('Erro ao salvar matéria.') }
  }

  async function handleDeleteDisc(id: string) {
    if (!confirm('Excluir esta matéria e todos os assuntos e questões associados?')) return
    try { await deleteDiscipline(id); toast.success('Matéria excluída.'); await loadAll() }
    catch { toast.error('Erro ao excluir matéria.') }
  }

  // ── Subjects ───────────────────────────────────────────────────────────────
  async function handleSaveSub() {
    if (!subForm?.name.trim() || !subForm.discipline_id) return toast.error('Preencha todos os campos obrigatórios')
    try {
      await saveSubject({ id: subForm.id, name: subForm.name, discipline_id: subForm.discipline_id, sort_order: Number(subForm.sort_order) || 0 })
      toast.success(subForm.id ? 'Assunto atualizado!' : 'Assunto criado!')
      setSubForm(null); await loadAll()
    } catch { toast.error('Erro ao salvar assunto.') }
  }

  async function handleDeleteSub(id: string) {
    if (!confirm('Excluir este assunto e todas as questões associadas?')) return
    try { await deleteSubject(id); toast.success('Assunto excluído.'); await loadAll() }
    catch { toast.error('Erro ao excluir assunto.') }
  }

  // ── Questions ──────────────────────────────────────────────────────────────
  function newQForm(): typeof qForm {
    return { discipline_id: qFilterDisc, subject_id: qFilterSubject, type: 'multiple_choice', statement: '', options: [{letter:'A',text:''},{letter:'B',text:''},{letter:'C',text:''}], correct_answer: 'A', comment: '', legal_basis: '', exam_tips: '', sort_order: '0', associated_text: '' }
  }

  function addOption() {
    if (!qForm) return
    const letters = 'ABCDE'
    const next = letters[qForm.options.length] ?? 'X'
    setQForm({ ...qForm, options: [...qForm.options, { letter: next, text: '' }] })
  }

  async function handleSaveQ() {
    if (!qForm?.statement.trim() || !qForm.subject_id || !qForm.discipline_id) return toast.error('Preencha todos os campos obrigatórios')
    try {
      await saveQuestion({
        id: qForm.id, statement: qForm.statement, type: qForm.type,
        options: qForm.type === 'multiple_choice' ? qForm.options : null,
        correct_answer: qForm.correct_answer, comment: qForm.comment,
        legal_basis: qForm.legal_basis || null, exam_tips: qForm.exam_tips || null,
        subject_id: qForm.subject_id, discipline_id: qForm.discipline_id,
        sort_order: Number(qForm.sort_order) || 0,
        associated_text: qForm.associated_text || null,
      })
      toast.success(qForm.id ? 'Questão atualizada!' : 'Questão criada!')
      setQForm(null); setShowInlineSub(false); setInlineSubName(''); await loadAll()
    } catch { toast.error('Erro ao salvar questão.') }
  }

  async function handleDeleteQ(id: string) {
    if (!confirm('Excluir esta questão?')) return
    try { await deleteQuestion(id); toast.success('Questão excluída.'); await loadAll() }
    catch { toast.error('Erro ao excluir questão.') }
  }

  // ── Questions: derived filter/sort/selection ──────────────────────────────
  const subjectsForQFilter = qFilterDisc
    ? subjects.filter(s => s.discipline_id === qFilterDisc)
    : subjects

  const filteredQuestions = (() => {
    const term = qSearch.trim().toLowerCase()
    let result = questions.filter(q => {
      if (qFilterDisc && q.discipline_id !== qFilterDisc) return false
      if (qFilterSubject && q.subject_id !== qFilterSubject) return false
      if (qFilterType && q.type !== qFilterType) return false
      if (term) {
        const disc = disciplines.find(d => d.id === q.discipline_id)
        const sub = subjects.find(s => s.id === q.subject_id)
        const haystack = [q.id, q.statement, disc?.name ?? '', sub?.name ?? '']
          .join(' ').toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
    if (qSort === 'recent') {
      result = [...result].sort((a, b) => b.created_at.localeCompare(a.created_at))
    } else if (qSort === 'discipline') {
      result = [...result].sort((a, b) => {
        const da = disciplines.find(d => d.id === a.discipline_id)?.name ?? ''
        const db = disciplines.find(d => d.id === b.discipline_id)?.name ?? ''
        return da.localeCompare(db, 'pt-BR')
      })
    } else if (qSort === 'subject') {
      result = [...result].sort((a, b) => {
        const sa = subjects.find(s => s.id === a.subject_id)?.name ?? ''
        const sb = subjects.find(s => s.id === b.subject_id)?.name ?? ''
        return sa.localeCompare(sb, 'pt-BR')
      })
    } else if (qSort === 'order') {
      result = [...result].sort((a, b) => {
        const aOrder = pendingOrder?.get(a.id) ?? a.sort_order ?? 0
        const bOrder = pendingOrder?.get(b.id) ?? b.sort_order ?? 0
        return aOrder - bOrder
      })
    }
    return result
  })()

  const allVisibleSelected =
    filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQIds.has(q.id))

  function toggleSelectAll() {
    setSelectedQIds(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        filteredQuestions.forEach(q => next.delete(q.id))
      } else {
        filteredQuestions.forEach(q => next.add(q.id))
      }
      return next
    })
  }

  function toggleSelectOne(id: string) {
    setSelectedQIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function copySelectedToClipboard() {
    const selected = filteredQuestions.filter(q => selectedQIds.has(q.id))
    if (selected.length === 0) return

    const gabarito = (q: Question) => {
      if (q.type === 'true_false') return q.correct_answer === 'C' ? 'Certo' : 'Errado'
      return q.correct_answer
    }

    const text = selected.map((q, i) =>
      `${i + 1}.\nEnunciado: ${q.statement}\nGabarito: ${gabarito(q)}\nComentário: ${q.comment ?? ''}`
    ).join('\n\n')

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast.success(`${selected.length} questão(ões) copiadas para a área de transferência.`),
        () => fallbackCopy(text)
      )
    } else {
      fallbackCopy(text)
    }
  }

  function handleReorderQ(q: Question, direction: 'up' | 'down') {
    const idx = filteredQuestions.findIndex(fq => fq.id === q.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= filteredQuestions.length) return

    const other = filteredQuestions[swapIdx]
    const aOrder = pendingOrder?.get(q.id) ?? q.sort_order ?? 0
    const bOrder = pendingOrder?.get(other.id) ?? other.sort_order ?? 0

    const newMap = new Map(pendingOrder ?? [])
    if (aOrder === bOrder) {
      newMap.set(q.id, direction === 'up' ? bOrder - 1 : bOrder + 1)
    } else {
      newMap.set(q.id, bOrder)
      newMap.set(other.id, aOrder)
    }
    setPendingOrder(newMap)
  }

  async function handleSaveOrder() {
    if (!pendingOrder) return

    // Normalize: assign 0, 1, 2... to the current filtered order (resolves duplicates)
    // Snapshot filteredQuestions before any state mutation
    const snapshot = filteredQuestions.map((q, idx) => ({ id: q.id, sort_order: idx }))
    const prevOrders = new Map(snapshot.map(u => {
      const q = questions.find(qq => qq.id === u.id)
      return [u.id, q?.sort_order ?? 0]
    }))

    // Optimistic: apply to local state immediately
    setQuestions(prev => {
      const map = new Map(snapshot.map(u => [u.id, u.sort_order]))
      return prev.map(q => ({ ...q, sort_order: map.get(q.id) ?? q.sort_order }))
    })

    const results = await Promise.all(
      snapshot.map(u => supabase.from('questions').update({ sort_order: u.sort_order }).eq('id', u.id))
    )

    if (results.some(r => r.error)) {
      toast.error('Erro ao salvar ordem.')
      // Rollback local state
      setQuestions(prev => prev.map(q => ({
        ...q,
        sort_order: prevOrders.has(q.id) ? prevOrders.get(q.id)! : q.sort_order,
      })))
    } else {
      toast.success('Ordem salva!')
      setPendingOrder(null)
    }
  }

  function handleCancelOrder() {
    setPendingOrder(null)
  }

  function fallbackCopy(text: string) {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    try {
      document.execCommand('copy')
      toast.success('Questões copiadas para a área de transferência.')
    } catch {
      toast.error('Não foi possível copiar. Tente novamente.')
    }
    document.body.removeChild(el)
  }

  async function handleCreateInlineSub() {
    if (!inlineSubName.trim() || !qForm?.discipline_id) return toast.error('Selecione a matéria e digite o nome do assunto')
    try {
      await saveSubject({ name: inlineSubName.trim(), discipline_id: qForm.discipline_id, sort_order: 0 })
      const updated = await getSubjects()
      setSubjects(updated)
      const created = updated.find(s => s.name === inlineSubName.trim() && s.discipline_id === qForm.discipline_id)
      if (created) setQForm(f => f ? { ...f, subject_id: created.id } : f)
      setInlineSubName('')
      setShowInlineSub(false)
      toast.success('Assunto criado e selecionado!')
    } catch { toast.error('Erro ao criar assunto.') }
  }

  function applyAltPasteBlock(text: string) {
    if (!qForm) return
    const lines = text.split('\n')
    const matched: { letter: string; text: string }[] = []

    // Estado para o formato "letra sozinha na linha"
    let pendingLetter: string | null = null
    let pendingLines: string[] = []

    function flushPending() {
      if (pendingLetter && pendingLines.length > 0) {
        matched.push({ letter: pendingLetter, text: pendingLines.join(' ').trim() })
      }
      pendingLetter = null
      pendingLines = []
    }

    for (const line of lines) {
      const trimmed = line.trim()

      // Formato inline: A) texto  ou  A. texto  ou  a) texto
      const inlineMatch = trimmed.match(/^([A-Ea-e])[.)]\s+(.+)/)
      if (inlineMatch) {
        flushPending()
        matched.push({ letter: inlineMatch[1].toUpperCase(), text: inlineMatch[2].trim() })
        continue
      }

      // Formato com letra sozinha na linha
      const letterOnly = trimmed.match(/^([A-Ea-e])$/)
      if (letterOnly) {
        flushPending()
        pendingLetter = letterOnly[1].toUpperCase()
        continue
      }

      // Linha de conteúdo pertencente à letra pendente
      if (pendingLetter && trimmed) {
        pendingLines.push(trimmed)
      }
    }
    flushPending()

    if (matched.length > 0) setQForm(f => f ? { ...f, options: matched } : f)
  }

  function renderQFormContent() {
    if (!qForm) return null
    return (
      <>
        <select value={qForm.discipline_id} onChange={e => setQForm({...qForm, discipline_id: e.target.value, subject_id: ''})} className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="">Selecione a matéria *</option>
          {disciplines.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
        </select>
        <div className="flex flex-col gap-1.5">
          <select
            value={showInlineSub ? '__new__' : qForm.subject_id}
            onChange={e => {
              if (e.target.value === '__new__') { setShowInlineSub(true) }
              else { setShowInlineSub(false); setQForm({...qForm, subject_id: e.target.value}) }
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Selecione o assunto *</option>
            {subjects.filter(s => s.discipline_id === qForm.discipline_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="__new__">+ Novo assunto</option>
          </select>
          {showInlineSub && (
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                value={inlineSubName}
                onChange={e => setInlineSubName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleCreateInlineSub() } }}
                placeholder="Nome do novo assunto"
                className="flex-1 rounded-md border border-primary bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button onClick={() => void handleCreateInlineSub()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 shrink-0">Criar</button>
              <button onClick={() => { setShowInlineSub(false); setInlineSubName('') }} className="text-sm text-muted-foreground hover:text-foreground shrink-0">✕</button>
            </div>
          )}
        </div>
        <select value={qForm.type} onChange={e => setQForm({...qForm, type: e.target.value as QuestionType, correct_answer: e.target.value === 'true_false' ? 'C' : 'A'})} className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="true_false">Certo / Errado</option>
          <option value="multiple_choice">Múltipla Escolha</option>
        </select>
        <textarea
          value={qForm.associated_text}
          onChange={e => setQForm({...qForm, associated_text: e.target.value})}
          onPaste={e => {
            const html = e.clipboardData.getData('text/html')
            if (!html) return
            e.preventDefault()
            setQForm(f => f ? {...f, associated_text: extractEmphasisFromHtml(html)} : f)
          }}
          placeholder="Texto associado (opcional)"
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <textarea
          value={qForm.statement}
          onChange={e => setQForm({...qForm, statement: e.target.value})}
          onPaste={e => {
            const html = e.clipboardData.getData('text/html')
            if (!html) return
            e.preventDefault()
            setQForm(f => f ? {...f, statement: extractEmphasisFromHtml(html)} : f)
          }}
          placeholder="Enunciado *"
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {qForm.type === 'multiple_choice' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Alternativas</p>
            {qForm.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-bold text-sm w-5">{opt.letter}.</span>
                <input
                  value={opt.text}
                  onChange={e => {
                    const opts = [...qForm.options]; opts[i] = {...opts[i], text: e.target.value}
                    setQForm({...qForm, options: opts})
                  }}
                  onPaste={e => {
                    const html = e.clipboardData.getData('text/html')
                    if (!html) return
                    e.preventDefault()
                    const text = extractEmphasisFromHtml(html)
                    const opts = [...qForm.options]; opts[i] = {...opts[i], text}
                    setQForm({...qForm, options: opts})
                  }}
                  placeholder={`Alternativa ${opt.letter}`}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ))}
            {qForm.options.length < 5 && (
              <button onClick={addOption} className="text-sm text-primary hover:underline self-start">+ Adicionar alternativa</button>
            )}
            <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-dashed border-border">
              <p className="text-xs text-muted-foreground">Colar bloco de alternativas (preenche A–E automaticamente)</p>
              <textarea
                placeholder={"A) alternativa\nB) alternativa\nC) alternativa"}
                rows={3}
                className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                onPaste={e => {
                  e.preventDefault()
                  applyAltPasteBlock(e.clipboardData.getData('text/plain'))
                }}
                onChange={e => { if (e.target.value) applyAltPasteBlock(e.target.value) }}
              />
            </div>
          </div>
        )}
        <div>
          <p className="text-sm font-medium mb-1">Resposta correta *</p>
          {qForm.type === 'true_false' ? (
            <div className="flex gap-2">
              {['C','E'].map(v => (
                <button key={v} onClick={() => setQForm({...qForm, correct_answer: v})} className={cn('rounded-md px-4 py-2 text-sm font-medium border transition-colors', qForm.correct_answer === v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary')}>
                  {v === 'C' ? 'Certo' : 'Errado'}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {qForm.options.map(opt => (
                <button key={opt.letter} onClick={() => setQForm({...qForm, correct_answer: opt.letter})} className={cn('rounded-md px-3 py-1.5 text-sm font-medium border transition-colors', qForm.correct_answer === opt.letter ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary')}>
                  {opt.letter}
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea
          value={qForm.comment}
          onChange={e => setQForm({...qForm, comment: e.target.value})}
          onPaste={e => {
            const html = e.clipboardData.getData('text/html')
            if (!html) return
            e.preventDefault()
            setQForm(f => f ? {...f, comment: extractEmphasisFromHtml(html, true)} : f)
          }}
          placeholder="Comentário / explicação *"
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input value={qForm.legal_basis} onChange={e => setQForm({...qForm, legal_basis: e.target.value})} placeholder="Fundamento Legal (opcional)" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
        <input value={qForm.exam_tips} onChange={e => setQForm({...qForm, exam_tips: e.target.value})} placeholder="Dica de prova (opcional)" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
        <div className="flex gap-2">
          <button onClick={handleSaveQ} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Salvar</button>
          <button onClick={() => { setQForm(null); setShowInlineSub(false); setInlineSubName('') }} className="text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        </div>
      </>
    )
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'disciplines', label: 'Matérias', icon: <BookOpen size={16}/> },
    { id: 'subjects', label: 'Assuntos', icon: <FileText size={16}/> },
    { id: 'questions', label: 'Questões', icon: <AlertTriangle size={16}/> },
    { id: 'users', label: 'Usuários', icon: <Users size={16}/> },
    { id: 'reports', label: 'Reportes', icon: <AlertTriangle size={16}/> },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Painel Administrativo" showBack />
      <div className="sticky top-[57px] z-30 bg-background border-b border-border">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  activeTab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-4">
        {/* ── DISCIPLINES ── */}
        {activeTab === 'disciplines' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Matérias ({disciplines.length})</h2>
              <button onClick={() => setDiscForm({ name: '', icon: '📚', group_name: '' })} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Plus size={14}/>Nova Matéria
              </button>
            </div>
            {discForm && (
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <h3 className="font-medium">{discForm.id ? 'Editar' : 'Nova'} Matéria</h3>
                <input value={discForm.name} onChange={e => setDiscForm({...discForm, name: e.target.value})} placeholder="Nome *" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                <input value={discForm.icon} onChange={e => setDiscForm({...discForm, icon: e.target.value})} placeholder="Ícone (emoji)" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                <select value={discForm.group_name} onChange={e => setDiscForm({...discForm, group_name: e.target.value})} className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Sem pasta (não aparece na Home)</option>
                  <option value="gerais">📚 Conhecimentos Gerais</option>
                  <option value="especificos">⚖️ Conhecimentos Específicos</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={handleSaveDisc} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Salvar</button>
                  <button onClick={() => setDiscForm(null)} className="text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {disciplines.map(d => (
                <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <span className="text-xl">{d.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {subjects.filter(s=>s.discipline_id===d.id).length} assuntos
                      {d.group_name && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {d.group_name === 'gerais' ? '📚 Gerais' : '⚖️ Específicos'}
                        </span>
                      )}
                    </p>
                  </div>
                  <button onClick={() => setDiscForm({id:d.id, name:d.name, icon:d.icon, group_name:d.group_name??''})} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil size={15}/></button>
                  <button onClick={() => handleDeleteDisc(d.id)} className="p-1.5 text-muted-foreground hover:text-red-500"><Trash2 size={15}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SUBJECTS ── */}
        {activeTab === 'subjects' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Assuntos ({subjects.length})</h2>
              <button onClick={() => setSubForm({ name: '', discipline_id: '', sort_order: '0' })} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Plus size={14}/>Novo Assunto
              </button>
            </div>
            {subForm && (
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <h3 className="font-medium">{subForm.id ? 'Editar' : 'Novo'} Assunto</h3>
                <input value={subForm.name} onChange={e => setSubForm({...subForm, name: e.target.value})} placeholder="Nome *" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                <select value={subForm.discipline_id} onChange={e => setSubForm({...subForm, discipline_id: e.target.value})} className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Selecione a matéria *</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
                </select>
                <input type="number" value={subForm.sort_order} onChange={e => setSubForm({...subForm, sort_order: e.target.value})} placeholder="Ordem (número)" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                <div className="flex gap-2">
                  <button onClick={handleSaveSub} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Salvar</button>
                  <button onClick={() => setSubForm(null)} className="text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {subjects.map(s => {
                const disc = disciplines.find(d => d.id === s.discipline_id)
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <div className="flex-1">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{disc?.icon} {disc?.name}</p>
                    </div>
                    <button onClick={() => setSubForm({id:s.id, name:s.name, discipline_id:s.discipline_id, sort_order:String(s.sort_order)})} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil size={15}/></button>
                    <button onClick={() => handleDeleteSub(s.id)} className="p-1.5 text-muted-foreground hover:text-red-500"><Trash2 size={15}/></button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── QUESTIONS ── */}
        {activeTab === 'questions' && (
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Questões ({questions.length})</h2>
              <button onClick={() => { setQForm(newQForm()); setShowInlineSub(false); setInlineSubName('') }} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Plus size={14}/>Nova Questão
              </button>
            </div>

            {/* Filter bar */}
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  value={qSearch}
                  onChange={e => setQSearch(e.target.value)}
                  placeholder="Buscar por ID, enunciado, matéria ou assunto..."
                  className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={qFilterDisc}
                  onChange={e => { setQFilterDisc(e.target.value); setQFilterSubject('') }}
                  className="flex-1 min-w-[140px] rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todas as matérias</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
                </select>
                <select
                  value={qFilterSubject}
                  onChange={e => setQFilterSubject(e.target.value)}
                  className="flex-1 min-w-[140px] rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todos os assuntos</option>
                  {subjectsForQFilter.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select
                  value={qFilterType}
                  onChange={e => setQFilterType(e.target.value as '' | QuestionType)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todos os tipos</option>
                  <option value="true_false">Certo / Errado</option>
                  <option value="multiple_choice">Múltipla Escolha</option>
                </select>
                <select
                  value={qSort}
                  onChange={e => { const v = e.target.value as typeof qSort; setQSort(v); if (v !== 'order') setPendingOrder(null) }}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="recent">Mais recentes</option>
                  <option value="discipline">Por matéria</option>
                  <option value="subject">Por assunto</option>
                  <option value="order">Por ordem (sort_order)</option>
                </select>
              </div>
            </div>

            {/* Question form — Nova Questão apenas (sem id) */}
            {qForm && !qForm.id && (
              <div className="rounded-xl border border-primary bg-card p-4 flex flex-col gap-3">
                <h3 className="font-medium">Nova Questão</h3>
                {renderQFormContent()}
              </div>
            )}

            {/* Selection header */}
            {filteredQuestions.length > 0 && (
              <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground flex-wrap">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
                <span className="flex-1">
                  {selectedQIds.size > 0 && (
                    <span className="text-foreground font-medium">{selectedQIds.size} selecionada{selectedQIds.size > 1 ? 's' : ''} · </span>
                  )}
                  {filteredQuestions.length} de {questions.length} questões
                </span>
                {qSort === 'order' && pendingOrder !== null && (
                  <>
                    <button
                      onClick={handleSaveOrder}
                      className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Check size={12}/>Salvar ordem
                    </button>
                    <button
                      onClick={handleCancelOrder}
                      className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <X size={12}/>Cancelar alterações
                    </button>
                  </>
                )}
                {selectedQIds.size > 0 && (
                  <button
                    onClick={copySelectedToClipboard}
                    className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                  >
                    Copiar selecionadas
                  </button>
                )}
              </div>
            )}
            {filteredQuestions.length === 0 && !qForm && (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma questão encontrada.</p>
            )}

            {/* Question list — com edição inline */}
            <div className="flex flex-col gap-2">
              {filteredQuestions.map(q => {
                const sub = subjects.find(s => s.id === q.subject_id)
                const disc = disciplines.find(d => d.id === q.discipline_id)

                // Edição inline: substitui o card pelo formulário
                if (qForm?.id === q.id) {
                  return (
                    <div key={q.id} className="rounded-xl border border-primary bg-card p-4 flex flex-col gap-3">
                      <h3 className="font-medium">Editar Questão</h3>
                      {renderQFormContent()}
                    </div>
                  )
                }

                return (
                  <div key={q.id} className={cn('rounded-xl border bg-card p-3 transition-colors', selectedQIds.has(q.id) ? 'border-primary/50 bg-primary/5' : 'border-border')}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedQIds.has(q.id)}
                        onChange={() => toggleSelectOne(q.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
                      />
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium shrink-0', q.type==='true_false' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary')}>
                        {q.type==='true_false'?'C/E':'MC'}
                      </span>
                      <p className="text-sm flex-1 line-clamp-2">{q.statement}</p>
                      <div className="flex gap-1 shrink-0">
                        {qSort === 'order' && (
                          <>
                            <button
                              onClick={() => handleReorderQ(q, 'up')}
                              disabled={filteredQuestions.indexOf(q) === 0}
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed"
                              title="Subir"
                            ><ChevronUp size={14}/></button>
                            <button
                              onClick={() => handleReorderQ(q, 'down')}
                              disabled={filteredQuestions.indexOf(q) === filteredQuestions.length - 1}
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed"
                              title="Descer"
                            ><ChevronDown size={14}/></button>
                          </>
                        )}
                        <button onClick={() => {
                          setShowInlineSub(false); setInlineSubName('')
                          setQForm({
                            id: q.id, discipline_id: q.discipline_id, subject_id: q.subject_id,
                            type: q.type, statement: q.statement, options: q.options ?? [{letter:'A',text:''},{letter:'B',text:''},{letter:'C',text:''}],
                            correct_answer: q.correct_answer, comment: q.comment,
                            legal_basis: q.legal_basis ?? '', exam_tips: q.exam_tips ?? '', sort_order: String(q.sort_order),
                            associated_text: q.associated_text ?? ''
                          })
                        }} className="p-1 text-muted-foreground hover:text-foreground"><Pencil size={14}/></button>
                        <button onClick={() => handleDeleteQ(q.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        title={q.id}
                        className="font-mono text-xs text-muted-foreground/60 cursor-default select-all"
                      >{q.id.slice(0, 8)}</span>
                      <span className="text-muted-foreground/40 text-xs">·</span>
                      <p className="text-xs text-muted-foreground">{disc?.icon} {disc?.name} › {sub?.name}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {activeTab === 'users' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xl font-bold">{profileStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xl font-bold text-green-500">{profileStats.approved}</p>
                <p className="text-xs text-muted-foreground">Com acesso</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xl font-bold text-amber-500">{profileStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xl font-bold text-red-500">{profileStats.suspended}</p>
                <p className="text-xs text-muted-foreground">Suspensos</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xl font-bold text-zinc-500">{profileStats.revoked}</p>
                <p className="text-xs text-muted-foreground">Revogados</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {profiles.map((p) => {
                const isApproved = p.status === 'approved'
                const isPending = p.status === 'pending'
                const isSuspended = p.status === 'suspended'
                const isRevoked = p.status === 'revoked'
                const isProtectedAdmin = normalizeEmail(p.email) === ADMIN_EMAIL

                const statusClass = isApproved
                  ? 'bg-green-100 text-green-700'
                  : isPending
                    ? 'bg-amber-100 text-amber-700'
                    : isSuspended
                      ? 'bg-red-100 text-red-700'
                      : 'bg-zinc-100 text-zinc-700'

                const statusLabel = isApproved
                  ? 'Aprovado'
                  : isPending
                    ? 'Pendente'
                    : isSuspended
                      ? 'Suspenso'
                      : 'Revogado'

                return (
                  <div key={p.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.name || p.email.split('@')[0]}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      {isProtectedAdmin && <p className="text-xs text-primary">Administrador principal</p>}
                      <p className="mt-1 text-xs text-muted-foreground">Criado em: {formatDateTime(p.created_at)}</p>
                      <p className="text-xs text-muted-foreground">Solicitou acesso em: {formatDateTime(p.requested_access_at)}</p>
                      {(() => {
                        const ac = activityCounts[p.user_id]
                        const t = ac?.today ?? 0
                        const w = ac?.week  ?? 0
                        const m = ac?.month ?? 0
                        const total = ac?.total ?? 0
                        return (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Hoje <span className="font-semibold text-foreground">{t}</span>
                            <span className="mx-1 opacity-40">•</span>
                            7d <span className="font-semibold text-foreground">{w}</span>
                            <span className="mx-1 opacity-40">•</span>
                            30d <span className="font-semibold text-foreground">{m}</span>
                            <span className="mx-1 opacity-40">•</span>
                            Total <span className="font-semibold text-foreground">{total}</span>
                          </p>
                        )
                      })()}
                    </div>
                    
                    {/* Badge de Status */}
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium shrink-0', statusClass)}>
                      {statusLabel}
                    </span>
                    
                    {/* Botões de Ação */}
                    <div className="flex gap-1">
                      {isProtectedAdmin ? (
                        <span className="px-2 py-1 text-xs text-muted-foreground">Protegido</span>
                      ) : null}
                      {isPending && (
                        <button
                          disabled={isProtectedAdmin}
                          onClick={async () => {
                            try {
                              await handleUserStatusChange(p.user_id, 'approved', 'Acesso liberado.')
                            } catch {
                              toast.error('Erro ao aprovar usuário.')
                            }
                          }}
                          className="p-1.5 rounded-md shrink-0 text-green-500 hover:bg-green-50"
                          title="Liberar acesso"
                        >
                          <Check size={16}/>
                        </button>
                      )}
                      {(isApproved || isPending) && (
                        <button
                          disabled={isProtectedAdmin}
                          onClick={async () => {
                            if (!confirm('Quer mesmo suspender este usuário?')) return
                            try {
                              await handleUserStatusChange(p.user_id, 'suspended', 'Acesso suspenso.')
                            } catch {
                              toast.error('Erro ao suspender usuário.')
                            }
                          }}
                          className="p-1.5 rounded-md shrink-0 text-red-500 hover:bg-red-50"
                          title="Suspender acesso"
                        >
                          <X size={16}/>
                        </button>
                      )}
                      {isSuspended && (
                        <button
                          disabled={isProtectedAdmin}
                          onClick={async () => {
                            try {
                              await handleUserStatusChange(p.user_id, 'pending', 'Usuário movido para pendentes.')
                            } catch {
                              toast.error('Erro ao mover usuário para pendente.')
                            }
                          }}
                          className="p-1.5 rounded-md shrink-0 text-amber-500 hover:bg-amber-50 text-xs font-medium"
                          title="Voltar para Pendentes"
                        >
                          Restaurar
                        </button>
                      )}
                      {isRevoked && (
                        <button
                          disabled={isProtectedAdmin}
                          onClick={async () => {
                            try {
                              await handleUserStatusChange(p.user_id, 'pending', 'Usuário revogado enviado para pendentes.')
                            } catch {
                              toast.error('Erro ao mover usuário revogado para pendente.')
                            }
                          }}
                          className="p-1.5 rounded-md shrink-0 text-amber-500 hover:bg-amber-50 text-xs font-medium"
                          title="Voltar para Pendentes"
                        >
                          Reavaliar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {activeTab === 'reports' && (
          <div className="flex flex-col gap-3">
            <h2 className="font-semibold">Reportes de erro ({reports.length})</h2>
            {reports.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum reporte recebido.</p>
            ) : (
              reports.map(r => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-1">Questão: {r.question_id.slice(0,8)}...</p>
                  <p className="text-sm">{r.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
