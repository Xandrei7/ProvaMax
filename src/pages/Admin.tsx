import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { extractEmphasisFromHtml, sanitizeTheoryHtml } from '@/lib/richText'
import { Plus, Pencil, Trash2, Check, X, Users, BookOpen, FileText, AlertTriangle, Search, ChevronUp, ChevronDown, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'
import {
  getDisciplines, saveDiscipline, deleteDiscipline,
  getSubjects, saveSubject, deleteSubject,
  getSubjectParts, saveSubjectPart, deleteSubjectPart,
  getQuestions, saveQuestion, deleteQuestion,
  getProfiles, updateUserStatus, getReports, ADMIN_EMAIL, normalizeEmail, getUserActivityCounts,
} from '@/lib/dataService'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Discipline, Subject, SubjectPart, Question, Profile, QuestionType, Theory } from '@/types'
import { getAllTheories, createTheory, updateTheory, deleteTheory } from '@/lib/theoryService'
// Fingerprint para detecção de duplicatas: strip HTML + prefixo banca/ano + lowercase
function _dupFp(statement: string, options?: { letter: string; text: string }[] | null): string {
  const clean = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  let core = clean(statement)
  core = core.replace(/^\s*\([^)]{0,150}\)\s*/, '')
  core = core.replace(/^\s*\[[^\]]{0,150}\]\s*/, '')
  core = core.replace(/^(?:[\w/]+\s*[-–]\s*){2,}/i, '').trim()
  return core + '\x01' + (options ?? []).map(o => clean(o.text)).join('\x00')
}

type Tab = 'disciplines' | 'subjects' | 'parts' | 'questions' | 'users' | 'reports' | 'theories'

export function Admin() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('disciplines')
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [parts, setParts] = useState<SubjectPart[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activityCounts, setActivityCounts] = useState<Record<string, { today: number; week: number; month: number; total: number }>>({})
  const [reports, setReports] = useState<{id:string;question_id:string;user_id:string;message:string;created_at:string}[]>([])
  const [theories, setTheories] = useState<Theory[]>([])
  const [tFilterDisc, setTFilterDisc] = useState('')
  const [tFilterSub, setTFilterSub] = useState('')
  const [tForm, setTForm] = useState<{
    id?: string; discipline_id: string; subject_id: string; title: string; content_html: string
    youtube_url: string; complementary_text: string
  } | null>(null)
  const tTextareaRef = useRef<HTMLTextAreaElement>(null)

  function wrapSelectionWithMark() {
    const el = tTextareaRef.current
    if (!el || !tForm) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start === end) { toast.error('Selecione um trecho no textarea primeiro'); return }
    const current = tForm.content_html
    const newText = current.substring(0, start) + `<mark>${current.substring(start, end)}</mark>` + current.substring(end)
    setTForm({ ...tForm, content_html: newText })
  }

  // Forms
  const [discForm, setDiscForm] = useState<{ id?: string; name: string; icon: string; group_name: string } | null>(null)
  const [subForm, setSubForm] = useState<{ id?: string; name: string; discipline_id: string; sort_order: string } | null>(null)
  const [partForm, setPartForm] = useState<{ id?: string; name: string; subject_id: string; sort_order: string } | null>(null)
  const [partFilterDisc, setPartFilterDisc] = useState('')
  const [partFilterSub, setPartFilterSub] = useState('')
  // ── Questions tab: filters / sort / selection ─────────────────────────────
  const [qSearch, setQSearch] = useState('')
  const [qFilterDisc, setQFilterDisc] = useState('')
  const [qFilterSubject, setQFilterSubject] = useState('')
  const [qFilterPart, setQFilterPart] = useState('')
  const [qFilterType, setQFilterType] = useState<'' | QuestionType>('')
  const [qSort, setQSort] = useState<'recent' | 'discipline' | 'subject' | 'order'>('recent')
  const [qShowDuplicates, setQShowDuplicates] = useState(false)
  const [selectedQIds, setSelectedQIds] = useState<Set<string>>(new Set())
  const [pendingOrder, setPendingOrder] = useState<Map<string, number> | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [showInlineSub, setShowInlineSub] = useState(false)
  const [inlineSubName, setInlineSubName] = useState('')

  const [qForm, setQForm] = useState<{
    id?: string; discipline_id: string; subject_id: string; part_id: string;
    type: QuestionType; statement: string; options: {letter:string;text:string}[];
    correct_answer: string; comment: string; legal_basis: string; exam_tips: string; sort_order: string;
    associated_text: string; specific_link: string;
  } | null>(null)
  const qCommentRef = useRef<HTMLTextAreaElement>(null)

  function autoResizeMobileTextarea(el: HTMLTextAreaElement) {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(min-width: 768px)').matches) return
    el.style.height = 'auto'
    const nextHeight = Math.min(Math.max(el.scrollHeight, 120), 520)
    el.style.height = `${nextHeight}px`
  }

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
    const [d, s, pts, q, p, r, ac] = await Promise.all([getDisciplines(), getSubjects(), getSubjectParts(), getQuestions(), getProfiles(), getReports(), getUserActivityCounts()])
    setDisciplines(d); setSubjects(s); setParts(pts); setQuestions(q); setProfiles(p); setReports(r); setActivityCounts(ac)
  }

  useEffect(() => { loadAll() }, [])
  useEffect(() => { if (activeTab === 'theories') loadTheories() }, [activeTab])

  useEffect(() => {
    if (location.state?.createTheory) {
      const { disciplineId, subjectId, title, content } = location.state.createTheory
      setActiveTab('theories')
      setTFilterDisc(disciplineId || '')
      setTFilterSub(subjectId || '')
      setTForm({
        discipline_id: disciplineId || '',
        subject_id: subjectId || '',
        title: title || '',
        content_html: content || '',
        youtube_url: '',
        complementary_text: '',
      })
      navigate('/admin', { replace: true, state: {} })
    }
  }, [location.state, navigate])

  useEffect(() => {
    if (!qForm) return
    if (!qCommentRef.current) return
    autoResizeMobileTextarea(qCommentRef.current)
  }, [qForm?.id])

  async function loadTheories() {
    const th = await getAllTheories()
    setTheories(th)
  }

  async function handleSaveTheory() {
    if (!tForm?.title.trim() || !tForm.subject_id || !tForm.discipline_id) return toast.error('Preencha todos os campos obrigatórios')
    try {
      const theoryPayload = {
        discipline_id: tForm.discipline_id,
        subject_id: tForm.subject_id,
        title: tForm.title,
        content_html: tForm.content_html,
        youtube_url: tForm.youtube_url.trim() || null,
        complementary_text: tForm.complementary_text.trim() || null,
      }
      if (tForm.id) {
        await updateTheory(tForm.id, theoryPayload)
        toast.success('Teoria atualizada!')
      } else {
        await createTheory(theoryPayload)
        toast.success('Teoria criada!')
      }
      setTForm(null)
      await loadTheories()
    } catch (err) { console.error('[Theory save error]', err); toast.error('Erro ao salvar teoria.') }
  }

  async function handleDeleteTheory(id: string) {
    if (!confirm('Excluir esta teoria?')) return
    try { await deleteTheory(id); toast.success('Teoria excluída.'); await loadTheories() }
    catch { toast.error('Erro ao excluir teoria.') }
  }

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

  // ── Parts ──────────────────────────────────────────────────────────────────
  async function handleSavePart() {
    if (!partForm?.name.trim() || !partForm.subject_id) return toast.error('Preencha todos os campos obrigatórios')
    try {
      await saveSubjectPart({ id: partForm.id, name: partForm.name, subject_id: partForm.subject_id, sort_order: Number(partForm.sort_order) || 0 })
      toast.success(partForm.id ? 'Parte atualizada!' : 'Parte criada!')
      setPartForm(null); await loadAll()
    } catch { toast.error('Erro ao salvar parte.') }
  }

  async function handleDeletePart(id: string) {
    if (!confirm('Excluir esta parte? As questões vinculadas ficam sem parte (assunto geral).')) return
    try { await deleteSubjectPart(id); toast.success('Parte excluída.'); await loadAll() }
    catch { toast.error('Erro ao excluir parte.') }
  }

  // ── Questions ──────────────────────────────────────────────────────────────
  function newQForm(): typeof qForm {
    return { discipline_id: qFilterDisc, subject_id: qFilterSubject, part_id: '', type: 'multiple_choice', statement: '', options: [{letter:'A',text:''},{letter:'B',text:''},{letter:'C',text:''}], correct_answer: 'A', comment: '', legal_basis: '', exam_tips: '', sort_order: '0', associated_text: '', specific_link: '' }
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
        part_id: qForm.part_id || null,
        sort_order: Number(qForm.sort_order) || 0,
        associated_text: qForm.associated_text || null,
        specific_link: qForm.specific_link.trim() || null,
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

  const partsForQFilter = qFilterSubject
    ? parts.filter(p => p.subject_id === qFilterSubject)
    : []

  const { duplicateFingerprints, duplicateQCount } = (() => {
    const fpCount = new Map<string, number>()
    for (const q of questions) {
      const fp = _dupFp(q.statement, q.options)
      fpCount.set(fp, (fpCount.get(fp) ?? 0) + 1)
    }
    const dupes = new Set<string>()
    let count = 0
    for (const [fp, c] of fpCount) {
      if (c > 1) { dupes.add(fp); count += c }
    }
    return { duplicateFingerprints: dupes, duplicateQCount: count }
  })()

  const filteredQuestions = (() => {
    const term = qSearch.trim().toLowerCase()
    let result = questions.filter(q => {
      if (qShowDuplicates && !duplicateFingerprints.has(_dupFp(q.statement, q.options))) return false
      if (qFilterDisc && q.discipline_id !== qFilterDisc) return false
      if (qFilterSubject && q.subject_id !== qFilterSubject) return false
      if (qFilterPart && q.part_id !== qFilterPart) return false
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

  // Posição real dentro do recorte atual (disc/assunto/parte), sem texto de busca nem tipo
  const questionPositions = (() => {
    const contextFiltered = questions.filter(q => {
      if (qFilterDisc && q.discipline_id !== qFilterDisc) return false
      if (qFilterSubject && q.subject_id !== qFilterSubject) return false
      if (qFilterPart && q.part_id !== qFilterPart) return false
      return true
    })
    const sorted = [...contextFiltered].sort((a, b) => {
      const aOrder = pendingOrder?.get(a.id) ?? a.sort_order ?? 0
      const bOrder = pendingOrder?.get(b.id) ?? b.sort_order ?? 0
      return aOrder - bOrder
    })
    const map = new Map<string, number>()
    sorted.forEach((q, i) => map.set(q.id, i + 1))
    return map
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

  async function deleteSelectedQuestions() {
    if (!confirm(`Excluir ${selectedQIds.size} questão(ões) selecionada(s)? Esta ação não pode ser desfeita.`)) return
    try {
      await Promise.all([...selectedQIds].map(id => deleteQuestion(id)))
      toast.success(`${selectedQIds.size} questão(ões) excluída(s).`)
      setSelectedQIds(new Set())
      await loadAll()
    } catch {
      toast.error('Erro ao excluir questões selecionadas.')
    }
  }

  function copySelectedToClipboard() {
    const selected = filteredQuestions.filter(q => selectedQIds.has(q.id))
    if (selected.length === 0) return

    const gabarito = (q: Question) => {
      if (q.type === 'true_false') return q.correct_answer === 'C' ? 'Certo' : 'Errado'
      return q.correct_answer
    }

    const text = selected.map((q, i) => {
      const opts = q.options && q.options.length > 0
        ? '\n' + q.options.map(o => `${o.letter}) ${o.text}`).join('\n')
        : ''
      return `${i + 1}.\nEnunciado: ${q.statement}${opts}\nGabarito: ${gabarito(q)}\nComentário: ${q.comment ?? ''}`
    }).join('\n\n')

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

  function handleDragReorder(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    const ids = filteredQuestions.map(q => q.id)
    const [moved] = ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, moved)
    const newMap = new Map(pendingOrder ?? [])
    ids.forEach((id, i) => newMap.set(id, i))
    setPendingOrder(newMap)
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

  function applyAltPasteBlock(rawText: string) {
    if (!qForm) return

    let text = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Adiciona quebra de linha antes de letras de alternativas se estiverem coladas em texto
      .replace(/([^\n\s])([a-eA-E][.)]\s)/g, '$1\n$2')
      .trim()
      
    // --- CAMADA ADITIVA MOBILE ISOLADA (Alternativas colapsadas) ---
    // Detecta padrão: AtextoBtexto... (sem pontuação e sem quebra)
    const isCollapsed = /[A-E][a-z\u00C0-\u00FF]{2,}.*?[B-E][a-z\u00C0-\u00FF]{2,}/.test(text)
    if (isCollapsed) {
      text = text.replace(/([A-E])([a-z\u00C0-\u00FF]{2,})/g, '\n$1) $2')
    }
    // ---------------------------------------------------------------

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

  // Versão HTML do parser: normaliza via extractEmphasisFromHtml (igual aos outros campos)
  // e depois roda a mesma lógica de linha do parser de texto puro.
  function applyAltPasteBlockFromHtml(html: string) {
    if (!qForm) return

    // extractEmphasisFromHtml já resolve toda complexidade de estrutura DOM:
    // blocos viram \n, só <b>/<i>/<u> sobrevivem — mesma função dos outros campos.
    const formatted = extractEmphasisFromHtml(html)

    console.log('[altPaste/html] formatted (primeiros 300):', formatted.slice(0, 300))

    const lines = formatted.split('\n')
    const matched: { letter: string; text: string }[] = []
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
      if (!trimmed) continue

      // Marcador em tag de ênfase: <b>A)</b> texto  <b>A</b><i>texto</i>
      const boldM = trimmed.match(/^<[biu]>([A-Ea-e])[.)]{0,1}<\/[biu]>\s*(.*)/)
      if (boldM) {
        console.log('[altPaste/html] linha → boldM', boldM[1], '|', trimmed.slice(0, 80))
        flushPending()
        matched.push({ letter: boldM[1].toUpperCase(), text: boldM[2].trim() })
        continue
      }

      // Marcador em texto puro: A) texto  A. texto  A texto
      const plainM = trimmed.match(/^([A-Ea-e])(?:[.)]\s*|\s+)(.+)/)
      if (plainM) {
        console.log('[altPaste/html] linha → plainM', plainM[1], '|', trimmed.slice(0, 80))
        flushPending()
        matched.push({ letter: plainM[1].toUpperCase(), text: plainM[2].trim() })
        continue
      }

      // Letra sozinha na linha
      if (/^[A-Ea-e]$/.test(trimmed)) {
        console.log('[altPaste/html] linha → letra sozinha', trimmed)
        flushPending()
        pendingLetter = trimmed.toUpperCase()
        continue
      }

      console.log('[altPaste/html] linha → não reconhecida:', trimmed.slice(0, 80))
      if (pendingLetter) pendingLines.push(trimmed)
    }
    flushPending()

    console.log('[altPaste/html] alternativas detectadas:', matched.length, matched.map(m => m.letter))
    if (matched.length > 0) {
      console.log('[altPaste/html] → setQForm chamado')
      setQForm(f => f ? { ...f, options: matched } : f)
    } else {
      // Fallback: plain text extraído do HTML
      console.log('[altPaste/html] → sem match, fallback plain')
      applyAltPasteBlock(new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '')
    }
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
              else { setShowInlineSub(false); setQForm({...qForm, subject_id: e.target.value, part_id: ''}) }
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
        {qForm.subject_id && parts.filter(p => p.subject_id === qForm.subject_id).length > 0 && (
          <select
            value={qForm.part_id}
            onChange={e => setQForm({...qForm, part_id: e.target.value})}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Sem parte (assunto geral)</option>
            {parts.filter(p => p.subject_id === qForm.subject_id).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <input
          value={qForm.specific_link}
          onChange={e => setQForm({...qForm, specific_link: e.target.value})}
          placeholder="Link específico da questão (opcional) — ex: vídeo, mapa mental, artigo..."
          type="url"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
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
          className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-y md:resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <textarea
          value={qForm.statement}
          onChange={e => setQForm({...qForm, statement: e.target.value})}
          onPaste={e => {
            const html = e.clipboardData.getData('text/html')
            if (!html) return
            e.preventDefault()
            const sanitized = extractEmphasisFromHtml(html)
            const target = e.target as HTMLTextAreaElement
            const start = target.selectionStart
            const end = target.selectionEnd
            const current = qForm.statement
            setQForm(f => f ? {...f, statement: current.substring(0, start) + sanitized + current.substring(end)} : f)
          }}
          placeholder="Enunciado *"
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-y md:resize-none focus:outline-none focus:ring-2 focus:ring-primary"
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
                className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm resize-y md:resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                onPaste={e => {
                  e.preventDefault()
                  const types = Array.from(e.clipboardData.types)
                  const plain = e.clipboardData.getData('text/plain')
                  const html  = e.clipboardData.getData('text/html')
                  console.log('[altPaste] tipos:', types)
                  console.log('[altPaste] text/plain tamanho:', plain.length, '| primeiros 120:', plain.slice(0, 120))
                  console.log('[altPaste] text/html  tamanho:', html.length,  '| primeiros 120:', html.slice(0, 120))
                  if (html) {
                    console.log('[altPaste] → caminho HTML')
                    applyAltPasteBlockFromHtml(html)
                  } else {
                    console.log('[altPaste] → caminho plain')
                    applyAltPasteBlock(plain)
                  }
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
          ref={qCommentRef}
          value={qForm.comment}
          onChange={e => setQForm({...qForm, comment: e.target.value})}
          onInput={e => autoResizeMobileTextarea(e.currentTarget)}
          onPaste={e => {
            const html = e.clipboardData.getData('text/html')
            if (!html) return
            e.preventDefault()
            const sanitized = extractEmphasisFromHtml(html, true)
            const target = e.target as HTMLTextAreaElement
            const start = target.selectionStart
            const end = target.selectionEnd
            const current = qForm.comment
            setQForm(f => f ? {...f, comment: current.substring(0, start) + sanitized + current.substring(end)} : f)
          }}
          placeholder="Comentário / explicação *"
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-y md:resize-none focus:outline-none focus:ring-2 focus:ring-primary"
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
    { id: 'parts', label: 'Partes', icon: <Layers size={16}/> },
    { id: 'questions', label: 'Questões', icon: <AlertTriangle size={16}/> },
    { id: 'theories', label: 'Teorias', icon: <BookOpen size={16}/> },
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

        {/* ── PARTS ── */}
        {activeTab === 'parts' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Partes ({parts.length})</h2>
              <button onClick={() => setPartForm({ name: '', subject_id: '', sort_order: '0' })} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Plus size={14}/>Nova Parte
              </button>
            </div>
            {partForm && (
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <h3 className="font-medium">{partForm.id ? 'Editar' : 'Nova'} Parte</h3>
                <input value={partForm.name} onChange={e => setPartForm({...partForm, name: e.target.value})} placeholder="Nome da parte *" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                <select value={partFilterDisc} onChange={e => { setPartFilterDisc(e.target.value); setPartForm({...partForm, subject_id: ''}) }} className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Filtrar por matéria (opcional)</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
                </select>
                <select value={partForm.subject_id} onChange={e => setPartForm({...partForm, subject_id: e.target.value})} className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Selecione o assunto *</option>
                  {(partFilterDisc ? subjects.filter(s => s.discipline_id === partFilterDisc) : subjects).map(s => {
                    const disc = disciplines.find(d => d.id === s.discipline_id)
                    return <option key={s.id} value={s.id}>{disc?.icon} {disc?.name} › {s.name}</option>
                  })}
                </select>
                <input type="number" value={partForm.sort_order} onChange={e => setPartForm({...partForm, sort_order: e.target.value})} placeholder="Ordem (número)" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                <div className="flex gap-2">
                  <button onClick={handleSavePart} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Salvar</button>
                  <button onClick={() => { setPartForm(null); setPartFilterDisc('') }} className="text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
                </div>
              </div>
            )}
            {/* Filtros */}
            <div className="flex gap-2">
              <select value={partFilterDisc} onChange={e => { setPartFilterDisc(e.target.value); setPartFilterSub('') }} className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Todas as matérias</option>
                {disciplines.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
              </select>
              <select value={partFilterSub} onChange={e => setPartFilterSub(e.target.value)} className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Todos os assuntos</option>
                {(partFilterDisc ? subjects.filter(s => s.discipline_id === partFilterDisc) : subjects).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              {parts
                .filter(p => {
                  const sub = subjects.find(s => s.id === p.subject_id)
                  if (partFilterSub && p.subject_id !== partFilterSub) return false
                  if (partFilterDisc && sub?.discipline_id !== partFilterDisc) return false
                  return true
                })
                .map(p => {
                  const sub = subjects.find(s => s.id === p.subject_id)
                  const disc = disciplines.find(d => d.id === sub?.discipline_id)
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                      <Layers size={14} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{disc?.icon} {disc?.name} › {sub?.name}</p>
                      </div>
                      <button onClick={() => { setPartFilterDisc(sub?.discipline_id ?? ''); setPartForm({id:p.id, name:p.name, subject_id:p.subject_id, sort_order:String(p.sort_order)}) }} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil size={15}/></button>
                      <button onClick={() => handleDeletePart(p.id)} className="p-1.5 text-muted-foreground hover:text-red-500"><Trash2 size={15}/></button>
                    </div>
                  )
                })}
              {parts.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhuma parte cadastrada.</p>}
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
                  onChange={e => { setQFilterDisc(e.target.value); setQFilterSubject(''); setQFilterPart('') }}
                  className="flex-1 min-w-[140px] rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todas as matérias</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
                </select>
                <select
                  value={qFilterSubject}
                  onChange={e => { setQFilterSubject(e.target.value); setQFilterPart('') }}
                  className="flex-1 min-w-[140px] rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todos os assuntos</option>
                  {subjectsForQFilter.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {partsForQFilter.length > 0 && (
                  <select
                    value={qFilterPart}
                    onChange={e => setQFilterPart(e.target.value)}
                    className="flex-1 min-w-[140px] rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Todas as partes</option>
                    {partsForQFilter.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
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
                <select
                  value={qShowDuplicates ? 'duplicates' : ''}
                  onChange={e => setQShowDuplicates(e.target.value === 'duplicates')}
                  className={cn(
                    'rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary',
                    qShowDuplicates ? 'border-orange-400 text-orange-600' : 'border-border'
                  )}
                >
                  <option value="">Todas as questões</option>
                  <option value="duplicates">{`Só duplicadas${duplicateQCount > 0 ? ` (${duplicateQCount})` : ''}`}</option>
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
                  <>
                    <button
                      onClick={copySelectedToClipboard}
                      className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                    >
                      Copiar selecionadas
                    </button>
                    <button
                      onClick={() => void deleteSelectedQuestions()}
                      className="flex items-center gap-1 rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 size={12} />
                      Excluir selecionadas
                    </button>
                  </>
                )}
              </div>
            )}
            {filteredQuestions.length === 0 && !qForm && (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma questão encontrada.</p>
            )}

            {/* Question list — com edição inline */}
            <div className="flex flex-col gap-2">
              {filteredQuestions.map((q, visibleIdx) => {
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
                  <div
                    key={q.id}
                    draggable={qSort === 'order'}
                    onDragStart={() => { setDragIdx(visibleIdx) }}
                    onDragOver={e => { if (qSort === 'order') e.preventDefault() }}
                    onDrop={() => { if (dragIdx !== null) { handleDragReorder(dragIdx, visibleIdx); setDragIdx(null) } }}
                    onDragEnd={() => setDragIdx(null)}
                    className={cn(
                      'rounded-xl border bg-card p-3 transition-colors',
                      selectedQIds.has(q.id) ? 'border-primary/50 bg-primary/5' : 'border-border',
                      qSort === 'order' && 'cursor-grab active:cursor-grabbing',
                      dragIdx === visibleIdx && 'opacity-40'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-6 text-right shrink-0 mt-0.5 select-none">{questionPositions.get(q.id) ?? visibleIdx + 1}</span>
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
                            id: q.id, discipline_id: q.discipline_id, subject_id: q.subject_id, part_id: q.part_id ?? '',
                            type: q.type, statement: q.statement, options: q.options ?? [{letter:'A',text:''},{letter:'B',text:''},{letter:'C',text:''}],
                            correct_answer: q.correct_answer, comment: q.comment,
                            legal_basis: q.legal_basis ?? '', exam_tips: q.exam_tips ?? '', sort_order: String(q.sort_order),
                            associated_text: q.associated_text ?? '', specific_link: q.specific_link ?? ''
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

        {/* ── THEORIES ── */}
        {activeTab === 'theories' && (() => {
          const tSubjects = tFilterDisc ? subjects.filter(s => s.discipline_id === tFilterDisc) : subjects
          const filteredTheories = theories.filter(t =>
            (!tFilterDisc || t.discipline_id === tFilterDisc) &&
            (!tFilterSub || t.subject_id === tFilterSub)
          )
          return (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold">Teorias ({filteredTheories.length})</h2>
                <button
                  onClick={() => setTForm({ discipline_id: tFilterDisc, subject_id: tFilterSub, title: '', content_html: '', youtube_url: '', complementary_text: '' })}
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus size={14}/>Nova Teoria
                </button>
              </div>

              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                <select
                  value={tFilterDisc}
                  onChange={e => { setTFilterDisc(e.target.value); setTFilterSub('') }}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todas as matérias</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select
                  value={tFilterSub}
                  onChange={e => setTFilterSub(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todos os assuntos</option>
                  {tSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Form */}
              {tForm && (
                <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                  <h3 className="font-medium">{tForm.id ? 'Editar' : 'Nova'} Teoria</h3>
                  <select
                    value={tForm.discipline_id}
                    onChange={e => setTForm({ ...tForm, discipline_id: e.target.value, subject_id: '' })}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Selecione a matéria *</option>
                    {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select
                    value={tForm.subject_id}
                    onChange={e => setTForm({ ...tForm, subject_id: e.target.value })}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Selecione o assunto *</option>
                    {subjects.filter(s => !tForm.discipline_id || s.discipline_id === tForm.discipline_id).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <input
                    value={tForm.title}
                    onChange={e => setTForm({ ...tForm, title: e.target.value })}
                    placeholder="Título *"
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex flex-col gap-1">
                    <textarea
                      ref={tTextareaRef}
                      value={tForm.content_html}
                      onChange={e => setTForm({ ...tForm, content_html: e.target.value })}
                      onPaste={e => {
                        const html = e.clipboardData.getData('text/html')
                        if (!html) return
                        e.preventDefault()
                        const cleaned = sanitizeTheoryHtml(html)
                        const target = e.target as HTMLTextAreaElement
                        const start = target.selectionStart
                        const end = target.selectionEnd
                        const current = tForm.content_html
                        setTForm(f => f ? { ...f, content_html: current.substring(0, start) + cleaned + current.substring(end) } : f)
                      }}
                      placeholder="Conteúdo HTML (suporta <b>, <u>, <mark>, <p>, <ul>, <li>)"
                      rows={10}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                    />
                    <button
                      type="button"
                      onClick={wrapSelectionWithMark}
                      className="self-start rounded-md border border-border bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800 hover:bg-yellow-100 transition-colors"
                    >
                      Marcar texto
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground font-medium">Link do YouTube</label>
                    <input
                      value={tForm.youtube_url}
                      onChange={e => setTForm({ ...tForm, youtube_url: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground font-medium">Texto complementar</label>
                    <textarea
                      value={tForm.complementary_text}
                      onChange={e => setTForm({ ...tForm, complementary_text: e.target.value })}
                      placeholder="Observações, referências ou dicas adicionais..."
                      rows={3}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveTheory} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                      <Check size={14}/>Salvar
                    </button>
                    <button onClick={() => setTForm(null)} className="text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
                  </div>
                </div>
              )}

              {/* List */}
              {filteredTheories.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma teoria encontrada.</p>
              ) : (
                filteredTheories.map(t => {
                  const disc = disciplines.find(d => d.id === t.discipline_id)
                  const sub = subjects.find(s => s.id === t.subject_id)
                  return (
                    <div key={t.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground">{disc?.name} › {sub?.name}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => setTForm({ id: t.id, discipline_id: t.discipline_id, subject_id: t.subject_id, title: t.title, content_html: t.content_html, youtube_url: t.youtube_url ?? '', complementary_text: t.complementary_text ?? '' })}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Editar"
                          >
                            <Pencil size={14}/>
                          </button>
                          <button
                            onClick={() => handleDeleteTheory(t.id)}
                            className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500"
                            title="Excluir"
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )
        })()}

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
