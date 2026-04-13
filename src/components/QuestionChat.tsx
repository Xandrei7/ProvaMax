import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import type { Question } from '@/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface QuestionChatProps {
  question: Question
}

export function QuestionChat({ question }: QuestionChatProps) {
  const { session } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Clear chat when question changes
  useEffect(() => {
    setMessages([])
    setInput('')
    setIsLoading(false)
  }, [question.id])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!input.trim() || isLoading) return
    if (!session?.access_token) return

    const userMessage = input.trim()
    setInput('')

    const newMessages = [...messages, { role: 'user' as const, content: userMessage }]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat-questao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          questionData: {
            statement: question.statement,
            correctAnswer: question.correct_answer,
            explanation: question.comment || '',
            options: question.options || []
          },
          discipline: (question as any).discipline_name || '',
          subject: (question as any).subject_name || '',
          disciplineId: question.discipline_id,
          subjectId: question.subject_id
        })
      })

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[FRONTEND QuestionChat] Erro na API. Status:', res.status, 'Resposta:', errorText);

        if (res.status === 404 && errorText.includes('<!doctype html>')) {
          throw new Error('A api/chat-questao retornou 404. É provável que o frontend esteja rodando via "vite" puro, que não sobe o backend. Rode usando "npx vercel dev".');
        }

        throw new Error(`Erro na API (${res.status}): ${errorText.substring(0, 50)}...`)
      }

      const data = await res.json()
      console.log('[FRONTEND QuestionChat] Resposta com sucesso:', data);

      setMessages([...newMessages, { role: 'assistant', content: data.reply }])
    } catch (err: any) {
      console.error('[FRONTEND QuestionChat] Catch Error:', err);
      setMessages([...newMessages, { role: 'assistant', content: err?.message || 'Ops, ocorreu um erro ao buscar a resposta. Tente novamente.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden mt-4">
      <div className="bg-primary/5 px-4 py-2 border-b border-border flex items-center gap-2">
        <Bot size={16} className="text-primary" />
        <span className="text-sm font-semibold text-primary">Tira-Dúvidas com IA</span>
      </div>

      <div className="p-4 flex flex-col gap-3 max-h-[300px] overflow-y-auto bg-muted/20">
        {messages.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground py-2">
            Ficou com dúvida sobre a resposta ou o comentário? Pergunte ao professor IA!
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2 max-w-[90%]", m.role === 'user' ? "self-end flex-row-reverse" : "self-start")}>
              <div className={cn("shrink-0 h-6 w-6 rounded-full flex items-center justify-center mt-1",
                m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
              )}>
                {m.role === 'user' ? <User size={12} /> : <Bot size={12} />}
              </div>
              <div className={cn("rounded-lg px-3 py-2 text-sm",
                m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-white border border-border dark:bg-muted/50"
              )}>
                <span className="whitespace-pre-line leading-relaxed">{m.content}</span>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-2 max-w-[90%] self-start">
            <div className="shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 flex items-center justify-center mt-1">
              <Bot size={12} />
            </div>
            <div className="rounded-lg px-3 py-2 text-sm bg-white border border-border dark:bg-muted/50 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 bg-background border-t border-border">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: Por que eu errei? / Explique mais simples / Qual a pegadinha?"
            className="w-full rounded-md bg-muted/50 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-1 p-1.5 text-primary hover:bg-primary/10 rounded-md disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}
