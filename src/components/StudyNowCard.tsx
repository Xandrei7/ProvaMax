import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Discipline, Subject, SubjectPart } from '@/types'
import {
  getCurrentWeek, getCurrentDayKey, buildDaySummaryForWeek,
  PLAN_TOTAL_WEEKS, getWeekMeta, loadSavedPlanWeek, savePlanWeek, loadSession, DEFAULT_PLAN_WEEK,
} from '@/lib/studyNowUtils'
import { DAY_LABELS } from '@/data/studyPlan'
import type { StudyDayKey } from '@/data/studyPlan'

interface Props {
  disciplines: Discipline[]
  subjects: Subject[]
  parts: SubjectPart[]
}

export function StudyNowCard({ disciplines, subjects, parts }: Props) {
  const navigate = useNavigate()
  const autoWeek = getCurrentWeek()
  const today = getCurrentDayKey()

  const [selectedWeek, setSelectedWeek] = useState(() => loadSavedPlanWeek() ?? DEFAULT_PLAN_WEEK)
  const [showWeekPicker, setShowWeekPicker] = useState(false)
  const weekScrollRef = useRef<HTMLDivElement>(null)

  const activeSession = loadSession()
  const selectedWeekSessionDay =
    activeSession && !activeSession.finished && activeSession.semana === selectedWeek
      ? activeSession.dia
      : null
  const selectedDay = (selectedWeekSessionDay ?? today) as StudyDayKey

  const summary = buildDaySummaryForWeek(selectedWeek, selectedDay, disciplines, subjects, parts)
  const weekMeta = getWeekMeta(selectedWeek)

  // Fecha picker ao clicar fora
  useEffect(() => {
    if (!showWeekPicker) return
    function close(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-week-picker]')) setShowWeekPicker(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showWeekPicker])

  // Scroll automático para semana selecionada
  useEffect(() => {
    const container = weekScrollRef.current
    if (!container) return
    const btn = container.querySelector<HTMLElement>('[data-selected="true"]')
    if (btn) btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [selectedWeek])

  if (summary.totalTasks === 0) return null

  const { hasActiveSession, missingTasks, totalTasks, nextTaskLabel, dia } = summary

  function handleSelectWeek(week: number) {
    setSelectedWeek(week)
    savePlanWeek(week)
  }

  function handlePlay() {
    savePlanWeek(selectedWeek)
    navigate('/study-now', {
      state: { semana: selectedWeek, dia },
    })
  }

  return (
    <div
      className="relative rounded-2xl"
      style={{
        overflow: 'clip',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 60%, #f0fdf4 100%)',
        border: '1.5px solid rgba(34,197,94,0.35)',
        boxShadow: '0 0 0 1px rgba(34,197,94,0.08), 0 4px 20px rgba(34,197,94,0.12), 0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Linha de acento verde no topo */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: 'linear-gradient(90deg, #16a34a, #22c55e, #16a34a)' }}
      />

      <div className="px-4 pt-4 pb-4">

        {/* ── Cabeçalho ── */}
        <div className="flex items-start gap-3">

          {/* Ícone livro verde */}
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0 mt-0.5"
            style={{
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              boxShadow: '0 2px 8px rgba(34,197,94,0.35)',
            }}
          >
            <BookOpen size={20} className="text-white" />
          </div>

          {/* Textos */}
          <div className="flex-1 min-w-0">

            {/* Título + badge pendente */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[15px] text-gray-900">
                {hasActiveSession ? 'Continuar sessão' : 'Estudar agora'}
              </span>
              {missingTasks > 0 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: '#fef3c7', color: '#b45309' }}
                >
                  <AlertTriangle size={9} />
                  {missingTasks} pendente{missingTasks > 1 ? 's' : ''}
                </span>
              )}
              {hasActiveSession && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: '#dcfce7', color: '#15803d' }}
                >
                  <CheckCircle2 size={9} />
                  em andamento
                </span>
              )}
            </div>

            {/* Linha info: semana · dia · tarefas */}
            <p className="text-xs text-gray-500 mt-0.5">
              Semana {selectedWeek}
              {' · '}{DAY_LABELS[dia]}
              {' · '}{totalTasks} tarefa{totalTasks !== 1 ? 's' : ''}
              {weekMeta.questoesMeta > 0 && (
                <span className="text-gray-400"> · meta {weekMeta.questoesMeta}q</span>
              )}
            </p>

            {/* Próxima tarefa */}
            {nextTaskLabel && (
              <p
                className="text-xs mt-1 truncate font-medium"
                style={{ color: '#15803d' }}
              >
                {hasActiveSession ? '▶ ' : ''}
                {nextTaskLabel}
              </p>
            )}
          </div>

          {/* Botão play vermelho */}
          <button
            onClick={handlePlay}
            className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              boxShadow: '0 3px 12px rgba(239,68,68,0.45)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.transform = 'scale(1.06)'
              el.style.boxShadow = '0 4px 18px rgba(239,68,68,0.6)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.transform = ''
              el.style.boxShadow = '0 3px 12px rgba(239,68,68,0.45)'
            }}
          >
            <Play size={17} className="text-white ml-0.5" fill="white" />
          </button>
        </div>

        {/* ── Seletor de semana ── */}
        <div className="mt-3 pt-3 border-t border-green-100" data-week-picker>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Semana do plano</span>
            {selectedWeek !== autoWeek && (
              <button
                onClick={() => handleSelectWeek(autoWeek)}
                className="text-[10px] text-green-600 hover:text-green-700 font-medium transition-colors"
              >
                Usar semana atual ({autoWeek})
              </button>
            )}
          </div>

          {/* Scroll horizontal de semanas */}
          <div
            ref={weekScrollRef}
            className="flex gap-1.5 pb-1"
            style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {Array.from({ length: PLAN_TOTAL_WEEKS }, (_, i) => i + 1).map(w => {
              const isSelected = w === selectedWeek
              return (
                <button
                  key={w}
                  data-selected={isSelected ? 'true' : undefined}
                  onClick={() => handleSelectWeek(w)}
                  className="shrink-0 flex flex-col items-center justify-center rounded-xl transition-all"
                  style={
                    isSelected
                      ? {
                          width: 44, height: 44,
                          background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                          boxShadow: '0 2px 8px rgba(34,197,94,0.4)',
                          color: 'white',
                        }
                      : {
                          width: 44, height: 44,
                          border: '1px solid #e5e7eb',
                          background: '#f9fafb',
                          color: '#6b7280',
                        }
                  }
                >
                  <span className="text-[11px] font-bold leading-none">{w}</span>
                  {isSelected && (
                    <span className="text-[8px] leading-none mt-0.5 font-medium opacity-70">hoje</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
