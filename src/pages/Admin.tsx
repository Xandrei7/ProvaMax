import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, Users, BookOpen, FileText, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/Header'
import {
  getDisciplines, saveDiscipline, deleteDiscipline,
  getSubjects, saveSubject, deleteSubject,
  getQuestions, saveQuestion, deleteQuestion,
  getProfiles, updateUserStatus, getReports, ADMIN_EMAIL, normalizeEmail,
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
  const [reports, setReports] = useState<{id:string;question_id:string;user_id:string;message:string;created_at:string}[]>([])

  // Forms
  const [discForm, setDiscForm] = useState<{ id?: string; name: string; icon: string } | null>(null)
  const [subForm, setSubForm] = useState<{ id?: string; name: string; discipline_id: string; sort_order: string } | null>(null)
  const [qForm, setQForm] = useState<{
    id?: string; discipline_id: string; subject_id: string;
    type: QuestionType; statement: string; options: {letter:string;text:string}[];
    correct_answer: string; comment: string; legal_basis: string; exam_tips: string; sort_order: string;
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
    const [d, s, q, p, r] = await Promise.all([getDisciplines(), getSubjects(), getQuestions(), getProfiles(), getReports()])
    setDisciplines(d); setSubjects(s); setQuestions(q); setProfiles(p); setReports(r)
  }

  useEffect(() => { loadAll() }, [])

  // ── Disciplines ────────────────────────────────────────────────────────────
  async function handleSaveDisc() {
    if (!discForm?.name.trim()) return toast.error('Nome obrigatório')
    try {
      await saveDiscipline({ id: discForm.id, name: discForm.name, icon: discForm.icon || '📚' })
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
    return { discipline_id: '', subject_id: '', type: 'true_false', statement: '', options: [{letter:'A',text:''},{letter:'B',text:''},{letter:'C',text:''}], correct_answer: 'C', comment: '', legal_basis: '', exam_tips: '', sort_order: '0' }
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
      })
      toast.success(qForm.id ? 'Questão atualizada!' : 'Questão criada!')
      setQForm(null); await loadAll()
    } catch { toast.error('Erro ao salvar questão.') }
  }

  async function handleDeleteQ(id: string) {
    if (!confirm('Excluir esta questão?')) return
    try { await deleteQuestion(id); toast.success('Questão excluída.'); await loadAll() }
    catch { toast.error('Erro ao excluir questão.') }
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
              <button onClick={() => setDiscForm({ name: '', icon: '📚' })} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Plus size={14}/>Nova Matéria
              </button>
            </div>
            {discForm && (
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <h3 className="font-medium">{discForm.id ? 'Editar' : 'Nova'} Matéria</h3>
                <input value={discForm.name} onChange={e => setDiscForm({...discForm, name: e.target.value})} placeholder="Nome *" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                <input value={discForm.icon} onChange={e => setDiscForm({...discForm, icon: e.target.value})} placeholder="Ícone (emoji)" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
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
                    <p className="text-xs text-muted-foreground">{subjects.filter(s=>s.discipline_id===d.id).length} assuntos</p>
                  </div>
                  <button onClick={() => setDiscForm({id:d.id, name:d.name, icon:d.icon})} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil size={15}/></button>
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
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Questões ({questions.length})</h2>
              <button onClick={() => setQForm(newQForm())} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Plus size={14}/>Nova Questão
              </button>
            </div>
            {qForm && (
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <h3 className="font-medium">{qForm.id ? 'Editar' : 'Nova'} Questão</h3>
                <select value={qForm.discipline_id} onChange={e => setQForm({...qForm, discipline_id:e.target.value, subject_id:''})} className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Selecione a matéria *</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
                </select>
                <select value={qForm.subject_id} onChange={e => setQForm({...qForm, subject_id:e.target.value})} className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Selecione o assunto *</option>
                  {subjects.filter(s => s.discipline_id === qForm.discipline_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={qForm.type} onChange={e => setQForm({...qForm, type:e.target.value as QuestionType, correct_answer: e.target.value==='true_false'?'C':'A'})} className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="true_false">Certo / Errado</option>
                  <option value="multiple_choice">Múltipla Escolha</option>
                </select>
                <textarea value={qForm.statement} onChange={e => setQForm({...qForm, statement:e.target.value})} placeholder="Enunciado *" rows={3} className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"/>
                {qForm.type === 'multiple_choice' && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Alternativas</p>
                    {qForm.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-bold text-sm w-5">{opt.letter}.</span>
                        <input value={opt.text} onChange={e => {
                          const opts = [...qForm.options]; opts[i] = {...opts[i], text: e.target.value}
                          setQForm({...qForm, options: opts})
                        }} placeholder={`Alternativa ${opt.letter}`} className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                      </div>
                    ))}
                    {qForm.options.length < 5 && (
                      <button onClick={addOption} className="text-sm text-primary hover:underline self-start">+ Adicionar alternativa</button>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium mb-1">Resposta correta *</p>
                  {qForm.type === 'true_false' ? (
                    <div className="flex gap-2">
                      {['C','E'].map(v => (
                        <button key={v} onClick={() => setQForm({...qForm, correct_answer:v})} className={cn('rounded-md px-4 py-2 text-sm font-medium border transition-colors', qForm.correct_answer===v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary')}>
                          {v === 'C' ? 'Certo' : 'Errado'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {qForm.options.map(opt => (
                        <button key={opt.letter} onClick={() => setQForm({...qForm, correct_answer:opt.letter})} className={cn('rounded-md px-3 py-1.5 text-sm font-medium border transition-colors', qForm.correct_answer===opt.letter ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary')}>
                          {opt.letter}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <textarea value={qForm.comment} onChange={e => setQForm({...qForm, comment:e.target.value})} placeholder="Comentário / explicação *" rows={3} className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"/>
                <input value={qForm.legal_basis} onChange={e => setQForm({...qForm, legal_basis:e.target.value})} placeholder="Fundamento Legal (opcional)" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                <input value={qForm.exam_tips} onChange={e => setQForm({...qForm, exam_tips:e.target.value})} placeholder="Dica de prova (opcional)" className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                <div className="flex gap-2">
                  <button onClick={handleSaveQ} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Salvar</button>
                  <button onClick={() => setQForm(null)} className="text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {questions.map(q => {
                const sub = subjects.find(s => s.id === q.subject_id)
                const disc = disciplines.find(d => d.id === q.discipline_id)
                return (
                  <div key={q.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium shrink-0', q.type==='true_false' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary')}>
                        {q.type==='true_false'?'C/E':'MC'}
                      </span>
                      <p className="text-sm flex-1 line-clamp-2">{q.statement}</p>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setQForm({
                          id:q.id, discipline_id:q.discipline_id, subject_id:q.subject_id,
                          type:q.type, statement:q.statement, options:q.options??[{letter:'A',text:''},{letter:'B',text:''},{letter:'C',text:''}],
                          correct_answer:q.correct_answer, comment:q.comment,
                          legal_basis:q.legal_basis??'', exam_tips:q.exam_tips??'', sort_order:String(q.sort_order)
                        })} className="p-1 text-muted-foreground hover:text-foreground"><Pencil size={14}/></button>
                        <button onClick={() => handleDeleteQ(q.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{disc?.icon} {disc?.name} › {sub?.name}</p>
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
