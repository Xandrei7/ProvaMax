import { useState, useEffect } from 'react'
import { Brain, Layers, Check, X, ShieldAlert, Zap } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { getFlashcards, updateFlashcardReview } from '@/lib/dataService'
import { useAuth } from '@/contexts/AuthContext'
import type { Flashcard } from '@/types'

type Phase = 'overview' | 'reviewing' | 'finished'

export function Flashcards() {
  const { user } = useAuth()
  const [phase, setPhase] = useState<Phase>('overview')
  const [loading, setLoading] = useState(true)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  
  // Review state
  const [dueCards, setDueCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    async function load() {
      if (!user) return
      setLoading(true)
      try {
        const data = await getFlashcards(user.id)
        setFlashcards(data)
      } catch (error) {
        console.error('Error fetching flashcards:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  function startReview() {
    const now = new Date()
    const due = flashcards.filter(f => {
      if (f.status === 'mastered') return false
      // If it's new
      if (f.status === 'new') return true
      // If it's time to review
      if (f.next_review_at && new Date(f.next_review_at) <= now) return true
      return false
    })

    if (due.length > 0) {
      setDueCards(due)
      setCurrentIndex(0)
      setIsFlipped(false)
      setPhase('reviewing')
    } else {
      setPhase('finished')
    }
  }

  async function handleAnswer(isCorrect: boolean) {
    if (updating) return
    setUpdating(true)
    
    const card = dueCards[currentIndex]
    try {
      await updateFlashcardReview(card.id, isCorrect)
      
      // Local state update
      setFlashcards(prev => prev.map(f => {
        if (f.id === card.id) {
          const times_correct = (f.times_correct || 0) + (isCorrect ? 1 : 0)
          const times_wrong = (f.times_wrong || 0) + (isCorrect ? 0 : 1)
          const times_seen = (f.times_seen || 0) + 1
          
          let status = f.status
          if (isCorrect && times_correct > 2 && times_correct > times_wrong) status = 'mastered'
          else if (!isCorrect) status = 'reviewing'
          
          return { ...f, times_seen, times_correct, times_wrong, status }
        }
        return f
      }))
    } catch (error) {
      console.error('Error updating review:', error)
    } finally {
      setUpdating(false)
      setIsFlipped(false)
      
      if (currentIndex < dueCards.length - 1) {
        setCurrentIndex(i => i + 1)
      } else {
        setPhase('finished')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const now = new Date()
  const dueCount = flashcards.filter(f => f.status !== 'mastered' && (!f.next_review_at || new Date(f.next_review_at) <= now)).length
  const masteredCount = flashcards.filter(f => f.status === 'mastered').length
  const newCount = flashcards.filter(f => f.status === 'new').length

  // -- OVERVIEW -------------------------------------------------------------
  if (phase === 'overview') {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header title="Flashcards" showBack={false} />
        <main className="mx-auto flex-1 w-full max-w-lg px-4 py-6 pb-24">
          <div className="flex flex-col gap-6">
            
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col items-center justify-center text-center">
              <Brain size={48} className="text-primary mb-4" />
              <h2 className="text-xl font-bold mb-2">Revisão Inteligente</h2>
              <p className="text-sm text-muted-foreground mb-6">
                A IA transforma seus erros em flashcards otimizados para memorização de longo prazo, focando na regra, pegadinha e antídoto.
              </p>
              
              <button 
                onClick={startReview}
                disabled={dueCount === 0}
                className="w-full rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]"
              >
                {dueCount > 0 ? `Revisar Agendados (${dueCount})` : 'Tudo Revisado! 🎉'}
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
                <span className="text-3xl font-bold">{flashcards.length}</span>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
                <span className="text-3xl font-bold text-amber-500">{newCount}</span>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Novos</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 col-span-2 lg:col-span-1">
                <span className="text-3xl font-bold text-green-500">{masteredCount}</span>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Dominados</span>
              </div>
            </div>

            {flashcards.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground space-y-2 mt-4">
                <Layers size={24} className="mx-auto mb-2 opacity-50" />
                <p>Nenhum flashcard gerado ainda.</p>
                <p className="text-xs">
                  Erre questões durante seus estudos ou simulados e a IA criará flashcards para você revisar aqui.
                </p>
              </div>
            )}
            
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // -- FINISHED -------------------------------------------------------------
  if (phase === 'finished') {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header title="Revisão Concluída" showBack={false} />
        <main className="mx-auto flex-1 w-full max-w-lg px-4 flex flex-col items-center justify-center pb-24 text-center">
          <div className="rounded-full bg-green-500/10 p-6 mb-6">
            <Check size={48} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Parabéns!</h2>
          <p className="text-muted-foreground mb-8 text-sm">
            Você não tem mais flashcards agendados para este momento. Volte mais tarde ou continue fazendo questões.
          </p>
          <button 
            onClick={() => setPhase('overview')}
            className="rounded-xl border border-border bg-card px-6 py-3 font-medium hover:bg-muted/50"
          >
            Voltar ao painel
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  // -- REVIEWING ------------------------------------------------------------
  const currentCard = dueCards[currentIndex]
  
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button 
          onClick={() => setPhase('overview')}
          className="text-sm font-medium text-muted-foreground hover:text-foreground mr-2"
        >
          Sair
        </button>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex) / dueCards.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-muted-foreground shrink-0 w-8 text-right">
          {currentIndex + 1}/{dueCards.length}
        </span>
      </div>

      <main className="mx-auto flex-1 w-full max-w-lg px-4 py-6 flex flex-col items-stretch justify-center pb-8 min-h-[calc(100vh-140px)]">
        
        {/* Flashcard Area */}
        <div className="flex-1 flex flex-col items-stretch justify-center gap-6 relative">
          
          {/* Front */}
          <div className="flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-border shadow-sm min-h-[250px] bg-card w-full">
            <h3 className="text-lg md:text-xl font-medium leading-relaxed">
              {currentCard.front_text}
            </h3>
          </div>

          {/* Back (Revealed) */}
          {isFlipped ? (
            <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4 fade-in duration-300 w-full pb-20">
              <div className="rounded-xl bg-card border border-border p-5">
                <p className="font-medium text-base mb-2">Gabarito da Banca</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{currentCard.back_answer}</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-5">
                  <div className="flex gap-2 items-center mb-2">
                    <ShieldAlert size={16} className="text-red-500" />
                    <p className="font-semibold text-red-500 text-sm">A Pegadinha</p>
                  </div>
                  <p className="text-red-900/80 dark:text-red-200/80 text-sm leading-relaxed">
                    {currentCard.back_trap}
                  </p>
                </div>

                <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-5">
                  <div className="flex gap-2 items-center mb-2">
                    <Zap size={16} className="text-green-500" />
                    <p className="font-semibold text-green-500 text-sm">Antídoto (SE {"->"} ENTÃO)</p>
                  </div>
                  <p className="text-green-900/80 dark:text-green-200/80 text-sm font-medium leading-relaxed">
                    {currentCard.back_antidote}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center w-full min-h-[200px]">
              <button 
                onClick={() => setIsFlipped(true)}
                className="rounded-full bg-muted px-8 py-4 font-semibold hover:bg-muted/80 hover:scale-105 transition-all shadow-sm active:scale-95"
              >
                Revelar Resposta
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Action Buttons Fixed at Bottom */}
      {isFlipped && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border z-20 animate-in slide-in-from-bottom-8">
          <div className="mx-auto max-w-lg flex gap-3">
            <button 
              onClick={() => handleAnswer(false)}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 text-red-500 px-4 py-4 font-bold hover:bg-red-500/10 active:scale-95 transition-all"
            >
              <X size={20} />
              Errei
            </button>
            <button 
              onClick={() => handleAnswer(true)}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-4 font-bold text-white shadow-lg hover:bg-green-600 active:scale-95 transition-all"
            >
              <Check size={20} />
              Acertei
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
