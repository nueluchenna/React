import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { PosterStudio } from './components/PosterStudio'
import { RulesChecklist } from './components/RulesChecklist'
import { WgDirectory } from './components/WgDirectory'
import { db, ensureSeedData } from './db'
import type { AppTab, Language, RuleCategory } from './types'

const LANG_STORAGE_KEY = 'wg-kompass-lang'
const ACTIVE_WG_STORAGE_KEY = 'wg-kompass-active-wg'

function readInitialLanguage(): Language {
  const saved = window.localStorage.getItem(LANG_STORAGE_KEY)
  return saved === 'en' ? 'en' : 'de'
}

function readInitialWgId(): number | null {
  const saved = window.localStorage.getItem(ACTIVE_WG_STORAGE_KEY)
  if (!saved) return null
  const parsed = Number(saved)
  return Number.isFinite(parsed) ? parsed : null
}

export function App() {
  const [lang, setLang] = useState<Language>(readInitialLanguage)
  const [activeTab, setActiveTab] = useState<AppTab>('rules')
  const [activeWgId, setActiveWgId] = useState<number | null>(readInitialWgId)
  const [posterRoom, setPosterRoom] = useState<RuleCategory | 'all'>('kitchen')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void ensureSeedData().then(() => setReady(true))
  }, [])

  const wgs = useLiveQuery(() => db.wgs.toArray(), [], [])
  const allRules = useLiveQuery(() => db.rules.toArray(), [], [])

  const activeWg = useMemo(
    () =>
      wgs.find((w) => w.id === activeWgId) ??
      wgs.find((w) => w.joined) ??
      wgs[0],
    [wgs, activeWgId],
  )

  useEffect(() => {
    if (activeWg?.id != null) {
      window.localStorage.setItem(ACTIVE_WG_STORAGE_KEY, String(activeWg.id))
    }
  }, [activeWg?.id])

  const activeWgRules = useMemo(() => {
    if (!activeWg?.id) return []
    return allRules
      .filter((r) => r.wgId === activeWg.id)
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1
        return b.createdAt - a.createdAt
      })
  }, [allRules, activeWg])

  const ruleCountByWg = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const r of allRules) {
      counts[r.wgId] = (counts[r.wgId] ?? 0) + 1
    }
    return counts
  }, [allRules])

  function handleToggleLang() {
    const next: Language = lang === 'de' ? 'en' : 'de'
    setLang(next)
    window.localStorage.setItem(LANG_STORAGE_KEY, next)
    document.documentElement.lang = next
  }

  function handleSelectWg(wgId: number) {
    setActiveWgId(wgId)
    window.localStorage.setItem(ACTIVE_WG_STORAGE_KEY, String(wgId))
    setActiveTab('rules')
  }

  function handleOpenPosterForRoom(room: RuleCategory | 'all') {
    setPosterRoom(room)
    setActiveTab('posters')
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900">
      <Header
        lang={lang}
        onToggleLang={handleToggleLang}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeWg={activeWg}
      />

      <main className="pb-16">
        {!ready || !activeWg ? (
          <div className="mx-auto max-w-6xl px-6 py-20 text-center text-sm text-stone-500">
            {lang === 'de' ? 'WG-Kompass wird geladen…' : 'Loading WG-Kompass…'}
          </div>
        ) : activeTab === 'rules' ? (
          <RulesChecklist
            lang={lang}
            wg={activeWg}
            rules={activeWgRules}
            onOpenPosterForRoom={handleOpenPosterForRoom}
          />
        ) : activeTab === 'posters' ? (
          <PosterStudio
            key={`${activeWg.id ?? 'wg'}-${posterRoom}`}
            lang={lang}
            wg={activeWg}
            rules={activeWgRules}
            initialRoom={posterRoom}
          />
        ) : (
          <WgDirectory
            lang={lang}
            wgs={wgs}
            ruleCountByWg={ruleCountByWg}
            activeWgId={activeWg.id ?? null}
            onSelectWg={handleSelectWg}
          />
        )}
      </main>
    </div>
  )
}

export default App
