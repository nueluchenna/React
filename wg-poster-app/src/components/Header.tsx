import {
  Building2,
  Check,
  CheckSquare,
  Cloud,
  Compass,
  HardDrive,
  Languages,
  Link2,
  Printer,
} from 'lucide-react'
import { useState } from 'react'
import { getCopy } from '../i18n'
import { buildShareableWgUrl } from '../lib/wgStore'
import type { AppTab, Language, WgProfile } from '../types'

interface HeaderProps {
  lang: Language
  onToggleLang: () => void
  activeTab: AppTab
  onSelectTab: (tab: AppTab) => void
  activeWg: WgProfile | undefined
  syncMode: 'supabase' | 'local'
}

export function Header({
  lang,
  onToggleLang,
  activeTab,
  onSelectTab,
  activeWg,
  syncMode,
}: HeaderProps) {
  const t = getCopy(lang)
  const [copied, setCopied] = useState(false)

  const navItems: { id: AppTab; label: string; icon: typeof CheckSquare }[] = [
    { id: 'rules', label: t.nav.rules, icon: CheckSquare },
    { id: 'posters', label: t.nav.posters, icon: Printer },
    { id: 'directory', label: t.nav.directory, icon: Building2 },
  ]

  async function handleCopyLink() {
    if (!activeWg) return
    const url = buildShareableWgUrl(activeWg.inviteCode)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t.copyWgLink, url)
    }
  }

  return (
    <header className="no-print sticky top-0 z-30 border-b border-stone-200/80 bg-[#FAF8F5]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand */}
        <button
          type="button"
          onClick={() => onSelectTab('rules')}
          className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-85"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-[#FAF8F5] shadow-sm">
            <Compass className="h-5 w-5 text-[#F4A261]" />
          </div>
          <div>
            <div className="font-display text-lg font-bold leading-tight tracking-tight text-stone-900">
              {t.appName}
            </div>
            <div className="hidden text-xs text-stone-500 sm:block">
              {t.appTagline}
            </div>
          </div>
        </button>

        {/* Primary Tabs */}
        <nav
          aria-label="Primary"
          className="order-3 flex w-full items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-xs sm:order-2 sm:w-auto"
        >
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all sm:flex-initial ${
                  isActive
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Right Controls: Sync Mode + Shareable WG Link + DE/EN Toggle */}
        <div className="order-2 flex items-center gap-2 sm:order-3">
          <span
            className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold lg:inline-flex ${
              syncMode === 'supabase'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-stone-200 bg-stone-100 text-stone-600'
            }`}
          >
            {syncMode === 'supabase' ? (
              <Cloud className="h-3 w-3 text-emerald-600" />
            ) : (
              <HardDrive className="h-3 w-3 text-stone-500" />
            )}
            <span>{syncMode === 'supabase' ? t.syncLive : t.syncLocal}</span>
          </span>

          {activeWg && (
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              title={t.copyWgLink}
              className="hidden items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-900 md:flex"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-semibold text-emerald-700">
                    {t.copiedWgLink}
                  </span>
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5 text-[#D95D39]" />
                  <span className="max-w-[130px] truncate">{activeWg.name}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleLang}
            className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50"
            aria-label="Toggle language DE / EN"
          >
            <Languages className="h-3.5 w-3.5 text-[#D95D39]" />
            <span className={lang === 'de' ? 'text-stone-900' : 'text-stone-400'}>
              DE
            </span>
            <span className="text-stone-300">/</span>
            <span className={lang === 'en' ? 'text-stone-900' : 'text-stone-400'}>
              EN
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
