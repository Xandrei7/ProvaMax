import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BookOpen, PlayCircle, ListVideo } from 'lucide-react'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { getTheoriesBySubject } from '@/lib/theoryService'
import { getSubjects } from '@/lib/dataService'
import { sanitizeTheoryHtml } from '@/lib/richText'
import type { Theory, Subject } from '@/types'

type YouTubeParsed =
  | { type: 'video'; id: string }
  | { type: 'playlist'; id: string }

function parseYouTubeUrl(url: string): YouTubeParsed | null {
  // Vídeo tem prioridade: v= ou youtu.be/
  const videoMatch = url.match(/(?:[?&]v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (videoMatch) return { type: 'video', id: videoMatch[1] }

  // Playlist: list= sem v=
  const playlistMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/)
  if (playlistMatch) return { type: 'playlist', id: playlistMatch[1] }

  return null
}

function VideoCard({ url }: { url: string }) {
  const parsed = parseYouTubeUrl(url)
  if (!parsed) return null

  if (parsed.type === 'video') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl overflow-hidden border border-border bg-card shadow-sm group mb-2"
      >
        <div className="relative w-full aspect-video">
          <img
            src={`https://img.youtube.com/vi/${parsed.id}/hqdefault.jpg`}
            alt="Miniatura do vídeo"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <PlayCircle size={52} className="text-white drop-shadow-lg" />
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-card">
          <PlayCircle size={14} className="text-primary shrink-0" />
          <span className="text-sm font-medium text-primary">Assistir aula em vídeo</span>
        </div>
      </a>
    )
  }

  // Playlist — fallback visual premium (YouTube não expõe miniatura de playlist por URL pública)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 rounded-xl border border-border bg-card shadow-sm px-4 py-4 group hover:bg-muted/30 transition-colors mb-2"
    >
      <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
        <ListVideo size={24} className="text-primary" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">Playlist de aulas</span>
        <span className="text-xs text-muted-foreground">Clique para assistir no YouTube</span>
      </div>
      <PlayCircle size={18} className="text-primary ml-auto shrink-0" />
    </a>
  )
}

export function TheoryView() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const [theories, setTheories] = useState<Theory[]>([])
  const [subject, setSubject] = useState<Subject | null>(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!subjectId) return
    async function load() {
      const [th, subs] = await Promise.all([
        getTheoriesBySubject(subjectId!),
        getSubjects(),
      ])
      setTheories(th)
      setSubject(subs.find(s => s.id === subjectId) ?? null)
      if (th.length > 0) setOpenId(th[0].id)
      setLoading(false)
    }
    load()
  }, [subjectId])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title={subject?.name ?? 'Teoria'} showBack />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : theories.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Nenhuma teoria cadastrada para este assunto.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {theories.map(theory => (
              <div key={theory.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setOpenId(openId === theory.id ? null : theory.id)}
                >
                  <BookOpen size={16} className="text-primary shrink-0" />
                  <span className="font-medium text-sm flex-1">{theory.title}</span>
                  <span className="text-muted-foreground text-xs">{openId === theory.id ? '▲' : '▼'}</span>
                </button>

                {openId === theory.id && (
                  <div className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-3">
                    {theory.youtube_url && <VideoCard url={theory.youtube_url} />}
                    <div
                      className="theory-content text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeTheoryHtml(theory.content_html) }}
                    />
                    {theory.complementary_text && (
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line border-t border-border pt-3">
                        {theory.complementary_text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
