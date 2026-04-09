/**
 * Agrupamento estático de disciplinas em pastas/grupos.
 * Matching por substring do nome (case-insensitive).
 *
 * ESCALA FUTURA: para adicionar um grupo, basta inserir um novo objeto aqui.
 * Quando o banco evoluir com uma coluna `group_id` em `disciplines`, a função
 * getGroupForDiscipline pode priorizar o valor do banco e usar este mapeamento
 * como fallback — sem quebrar nada.
 */

export interface DisciplineSubgroup {
  id: string
  label: string
  icon: string
  /** Substrings do nome da disciplina (case-insensitive) que pertencem a este subgrupo */
  nameMatches: string[]
}

export interface DisciplineGroup {
  id: string
  label: string
  description: string
  icon: string
  /** Classes Tailwind de cor para accent visual — bg leve, texto, borda */
  color: {
    bg: string       // ex: 'bg-blue-500/10'
    iconBg: string   // ex: 'bg-blue-500/15'
    text: string     // ex: 'text-blue-600'
    border: string   // ex: 'border-blue-500/30'
    badge: string    // ex: 'bg-blue-500/10 text-blue-700'
  }
  /** Substrings do nome da disciplina (case-insensitive) que pertencem a este grupo */
  nameMatches: string[]
  /** Subpastas dentro deste grupo (opcional) */
  subgroups?: DisciplineSubgroup[]
}

export const DISCIPLINE_GROUPS: DisciplineGroup[] = [
  {
    id: 'gerais',
    label: 'Conhecimentos Gerais',
    description: 'Legislação, regimentos e normas da ALE-RR',
    icon: '📚',
    color: {
      bg: 'bg-blue-500/5',
      iconBg: 'bg-blue-500/10',
      text: 'text-blue-600',
      border: 'border-blue-500/25',
      badge: 'bg-blue-500/10 text-blue-700',
    },
    nameMatches: [
      'código de ética parlamentar',
      'lei complementar',
      'regimento interno',
      'resolução',
      'constituição do estado de roraima',
    ],
    subgroups: [
      {
        id: 'portugues',
        label: 'Português',
        icon: '📝',
        nameMatches: ['português', 'lingua portuguesa', 'língua portuguesa', 'redação'],
      },
      {
        id: 'legislacao',
        label: 'Legislação Institucional',
        icon: '📜',
        nameMatches: [
          'constituição do estado de roraima',
          'regimento interno',
          'código de ética parlamentar',
          'resolução',
          'lei complementar',
        ],
      },
      {
        id: 'geografia',
        label: 'Geografia e História',
        icon: '🗺️',
        nameMatches: ['geografia', 'história', 'historia'],
      },
    ],
  },
  {
    id: 'especificos',
    label: 'Conhecimentos Específicos',
    description: 'Direito Constitucional e Administrativo',
    icon: '⚖️',
    color: {
      bg: 'bg-violet-500/5',
      iconBg: 'bg-violet-500/10',
      text: 'text-violet-600',
      border: 'border-violet-500/25',
      badge: 'bg-violet-500/10 text-violet-700',
    },
    nameMatches: [
      'constitucional',
      'direito administrativo',
    ],
  },
]

/**
 * Retorna o grupo ao qual uma disciplina pertence.
 *
 * Prioridade:
 *  1. group_name do banco (coluna `group_name` da tabela `disciplines`)
 *  2. Fallback: substring matching estático pelo nome (compatibilidade com disciplinas antigas)
 *  3. null se não mapeada em nenhum dos dois
 */
export function getGroupForDiscipline(disciplineName: string, groupName?: string | null): DisciplineGroup | null {
  // 1. Grupo explícito do banco.
  //    Aceita tanto o `id` interno (ex: 'gerais') quanto o `label` completo
  //    (ex: 'Conhecimentos Gerais') — que é o valor salvo em disciplines.group_name.
  if (groupName) {
    const normalizedGroupName = groupName.trim().toLowerCase()
    const byIdOrLabel = DISCIPLINE_GROUPS.find(
      g => g.id === groupName || g.label.toLowerCase() === normalizedGroupName,
    )
    if (byIdOrLabel) return byIdOrLabel
  }

  // 2. Fallback: matching estático por nome (disciplinas antigas sem group_name)
  const lower = disciplineName.toLowerCase()
  return DISCIPLINE_GROUPS.find(g =>
    g.nameMatches.some(match => lower.includes(match.toLowerCase()))
  ) ?? null
}
