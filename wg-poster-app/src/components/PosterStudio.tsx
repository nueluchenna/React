import {
  Check,
  Compass,
  Flag,
  Printer,
  Scissors,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  CATEGORY_ORDER,
  getCategoryLabel,
  getCopy,
  getFrequencyLabel,
} from '../i18n'
import type {
  Language,
  PosterFormat,
  PosterTheme,
  RuleCategory,
  WgProfile,
  WgRule,
} from '../types'
import { CATEGORY_META } from '../utils/categoryMeta'

interface PosterStudioProps {
  lang: Language
  wg: WgProfile
  rules: WgRule[]
  initialRoom: RuleCategory | 'all'
}

export function PosterStudio({
  lang,
  wg,
  rules,
  initialRoom,
}: PosterStudioProps) {
  const t = getCopy(lang)

  const [room, setRoom] = useState<RuleCategory | 'all'>(initialRoom)
  const [format, setFormat] = useState<PosterFormat>('poster_a4')
  const [theme, setTheme] = useState<PosterTheme>('bauhaus')
  const [customTitle, setCustomTitle] = useState('')
  const [customSubtitle, setCustomSubtitle] = useState('')
  const [showCheckboxes, setShowCheckboxes] = useState(true)
  const [showBadges, setShowBadges] = useState(true)
  const [showFooter, setShowFooter] = useState(true)
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set())

  const roomRules = useMemo(() => {
    if (room === 'all') return rules
    return rules.filter((r) => r.category === room)
  }, [rules, room])

  const activeRules = useMemo(() => {
    return roomRules.filter((r) => r.id == null || !excludedIds.has(r.id))
  }, [roomRules, excludedIds])

  const defaultHeadline = useMemo(() => {
    if (room === 'all') {
      return lang === 'de' ? 'Unsere WG-Regeln' : 'Our House Rules'
    }
    const label = getCategoryLabel(room, lang)
    return lang === 'de' ? `${label}-Regeln` : `${label} Rules`
  }, [room, lang])

  const headline = customTitle.trim() || defaultHeadline
  const subtitle = customSubtitle.trim() || `${wg.name} · ${t.posters.defaultSubtitle}`

  const accentHex =
    room === 'all' ? '#D95D39' : CATEGORY_META[room].accentHex
  const softHex = room === 'all' ? '#FEF3EC' : CATEGORY_META[room].softHex

  const RoomIcon = room === 'all' ? Compass : CATEGORY_META[room].icon

  function toggleRule(id: number | undefined) {
    if (id == null) return
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleRoomChange(nextRoom: RuleCategory | 'all') {
    setRoom(nextRoom)
    setExcludedIds(new Set())
    setCustomTitle('')
  }

  const themeClasses = {
    bauhaus: {
      canvas: 'bg-white border-[3px] border-stone-900 rounded-none',
      headerStyle: { backgroundColor: accentHex, color: '#FFFFFF' },
      ruleCard: 'border-2 border-stone-900 bg-white',
      badge: 'border border-stone-900 bg-stone-100 text-stone-900',
      checkbox: 'border-2 border-stone-900',
      footer: 'border-t-2 border-stone-900 bg-stone-100 text-stone-800',
    },
    warm_kitchen: {
      canvas: 'bg-[#FFFBF2] border-2 border-stone-200 rounded-3xl',
      headerStyle: { backgroundColor: softHex, color: '#1C1917' },
      ruleCard: 'border border-stone-200/90 bg-white/90 rounded-2xl',
      badge: 'bg-stone-100 text-stone-700 rounded-full',
      checkbox: 'border-2 border-stone-400 rounded-md',
      footer: 'border-t border-stone-200 bg-[#F7F1E3] text-stone-700 rounded-b-3xl',
    },
    ink_saver: {
      canvas: 'bg-white border-2 border-black rounded-lg',
      headerStyle: {
        backgroundColor: '#FFFFFF',
        color: '#000000',
        borderBottom: '2px solid #000000',
      },
      ruleCard: 'border border-black/80 bg-white rounded-md',
      badge: 'border border-black text-black bg-white rounded-sm',
      checkbox: 'border-2 border-black',
      footer: 'border-t-2 border-black bg-white text-black',
    },
  }[theme]

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Studio Header (hidden on print) */}
      <div className="no-print flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-stone-900">
            {t.posters.heading}
          </h1>
          <p className="mt-1 text-sm text-stone-600">{t.posters.subheading}</p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          disabled={activeRules.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D95D39] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#c14f2d] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Printer className="h-4 w-4" />
          <span>{t.posters.printBtn}</span>
        </button>
      </div>

      {/* Main Split Layout */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Left Controls Sidebar (hidden on print) */}
        <aside className="no-print space-y-5 lg:col-span-4">
          {/* Format Picker */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {t.posters.formatLabel}
            </h2>
            <div className="mt-2.5 grid grid-cols-1 gap-2">
              {(['poster_a4', 'card_a5', 'stickers'] as PosterFormat[]).map(
                (fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                      format === fmt
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 bg-[#FAF8F5] text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    <span>{t.posters.formats[fmt]}</span>
                    {format === fmt && <Check className="h-4 w-4" />}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Room Scope */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {t.posters.roomLabel}
            </h2>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleRoomChange('all')}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  room === 'all'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-[#FAF8F5] text-stone-700 hover:border-stone-400'
                }`}
              >
                {getCategoryLabel('all', lang)}
              </button>
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleRoomChange(cat)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    room === cat
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-[#FAF8F5] text-stone-700 hover:border-stone-400'
                  }`}
                >
                  {getCategoryLabel(cat, lang)}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Theme */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {t.posters.themeLabel}
            </h2>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {(['bauhaus', 'warm_kitchen', 'ink_saver'] as PosterTheme[]).map(
                (th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => setTheme(th)}
                    className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold transition-colors ${
                      theme === th
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 bg-[#FAF8F5] text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    {t.posters.themes[th]}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Customize Text & Toggles */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              {t.posters.customizeLabel}
            </h2>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">
                {t.posters.customTitle}
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={defaultHeadline}
                className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">
                {t.posters.customSubtitle}
              </label>
              <input
                type="text"
                value={customSubtitle}
                onChange={(e) => setCustomSubtitle(e.target.value)}
                placeholder={`${wg.name} · ${t.posters.defaultSubtitle}`}
                className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="space-y-2 pt-1 text-xs font-medium text-stone-700">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={showCheckboxes}
                  onChange={(e) => setShowCheckboxes(e.target.checked)}
                  className="h-4 w-4 accent-stone-900"
                />
                <span>{t.posters.showCheckboxes}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={showBadges}
                  onChange={(e) => setShowBadges(e.target.checked)}
                  className="h-4 w-4 accent-stone-900"
                />
                <span>{t.posters.showBadges}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={showFooter}
                  onChange={(e) => setShowFooter(e.target.checked)}
                  className="h-4 w-4 accent-stone-900"
                />
                <span>{t.posters.showFooter}</span>
              </label>
            </div>
          </div>

          {/* Included Rules Picker */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                {t.posters.includedRules} ({activeRules.length}/{roomRules.length})
              </h2>
              {excludedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setExcludedIds(new Set())}
                  className="text-xs font-semibold text-[#D95D39] hover:underline"
                >
                  {t.posters.selectAll}
                </button>
              )}
            </div>
            <div className="mt-2.5 max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {roomRules.map((rule) => {
                const included = rule.id == null || !excludedIds.has(rule.id)
                return (
                  <label
                    key={rule.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 text-xs hover:bg-stone-50"
                  >
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => toggleRule(rule.id)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-stone-900"
                    />
                    <span
                      className={
                        included ? 'text-stone-800' : 'text-stone-400 line-through'
                      }
                    >
                      {rule.title}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </aside>

        {/* Right Live Print Preview */}
        <div className="print-only-wrapper lg:col-span-8">
          <div className="no-print mb-2 flex items-center justify-between text-xs text-stone-500">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-[#D95D39]" />
              {t.posters.formats[format]} · {t.posters.themes[theme]}
            </span>
            <span>
              {activeRules.length} {t.rules.totalRules}
            </span>
          </div>

          {activeRules.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-stone-300 bg-white/70 p-16 text-center text-sm text-stone-500">
              {t.posters.emptyPoster}
            </div>
          ) : format === 'stickers' ? (
            /* STICKER SHEET FORMAT (6 Cut-Out Visual Stickers) */
            <div className="print-canvas rounded-3xl border border-stone-200 bg-white p-6 shadow-md sm:p-8">
              <div className="mb-5 flex items-center justify-between border-b border-dashed border-stone-300 pb-3">
                <div>
                  <div className="font-display text-xl font-bold text-stone-900">
                    {headline}
                  </div>
                  <div className="text-xs text-stone-500">{subtitle}</div>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
                  <Scissors className="h-4 w-4" />
                  <span>{t.posters.cutLineHint}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {activeRules.slice(0, 6).map((rule) => {
                  const meta = CATEGORY_META[rule.category]
                  const Icon = meta.icon
                  const isInkSaver = theme === 'ink_saver'
                  return (
                    <div
                      key={rule.id}
                      className="flex flex-col justify-between rounded-2xl border-2 border-dashed border-stone-400 p-4"
                      style={{
                        backgroundColor: isInkSaver
                          ? '#FFFFFF'
                          : theme === 'warm_kitchen'
                            ? meta.softHex
                            : '#FFFFFF',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: isInkSaver
                              ? '#000000'
                              : meta.accentHex,
                            color: '#FFFFFF',
                          }}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isInkSaver
                              ? 'border border-black text-black'
                              : 'bg-stone-900 text-white'
                          }`}
                        >
                          {getCategoryLabel(rule.category, lang)}
                        </span>
                      </div>

                      <div className="mt-3">
                        <p className="font-display text-base font-bold leading-snug text-stone-900">
                          {rule.title}
                        </p>
                        {rule.details && (
                          <p className="mt-1 text-xs leading-snug text-stone-600">
                            {rule.details}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                        <span>{wg.name}</span>
                        <span>{getFrequencyLabel(rule.frequency, lang)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* WALL POSTER (A4) OR FRIDGE CARD (A5) */
            <div
              className={`print-canvas mx-auto overflow-hidden shadow-lg ${themeClasses.canvas} ${
                format === 'card_a5' ? 'max-w-lg' : 'w-full'
              }`}
            >
              {/* Poster Header */}
              <div
                style={themeClasses.headerStyle}
                className={format === 'card_a5' ? 'p-5 sm:p-6' : 'p-6 sm:p-8'}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`flex shrink-0 items-center justify-center ${
                        format === 'card_a5' ? 'h-11 w-11' : 'h-14 w-14'
                      } ${
                        theme === 'bauhaus'
                          ? 'border-2 border-white/40 bg-black/15'
                          : theme === 'ink_saver'
                            ? 'border-2 border-black bg-white text-black'
                            : 'rounded-2xl bg-white shadow-xs'
                      }`}
                    >
                      <RoomIcon
                        className={format === 'card_a5' ? 'h-6 w-6' : 'h-7 w-7'}
                        style={
                          theme === 'warm_kitchen'
                            ? { color: accentHex }
                            : undefined
                        }
                      />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">
                        {wg.name} · {wg.city}
                      </div>
                      <h2
                        className={`font-display font-bold leading-tight tracking-tight ${
                          format === 'card_a5'
                            ? 'text-2xl'
                            : 'text-3xl sm:text-4xl'
                        }`}
                      >
                        {headline}
                      </h2>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs font-medium opacity-85 sm:text-sm">
                  {subtitle}
                </p>
              </div>

              {/* Poster Rules Body */}
              <div
                className={
                  format === 'card_a5'
                    ? 'space-y-2.5 p-5'
                    : 'space-y-3 p-6 sm:p-8'
                }
              >
                {activeRules.map((rule, index) => {
                  const Icon = CATEGORY_META[rule.category].icon
                  return (
                    <div
                      key={rule.id ?? index}
                      className={`flex items-start gap-3.5 ${
                        format === 'card_a5' ? 'p-3' : 'p-4'
                      } ${themeClasses.ruleCard}`}
                    >
                      {showCheckboxes ? (
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center ${themeClasses.checkbox}`}
                        />
                      ) : (
                        <span className="font-display mt-0.5 w-5 shrink-0 text-center text-sm font-bold text-stone-500">
                          {index + 1}.
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`font-semibold leading-snug text-stone-900 ${
                              format === 'card_a5' ? 'text-sm' : 'text-base'
                            }`}
                          >
                            {rule.title}
                          </p>
                          {rule.priority === 'high' && (
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                theme === 'ink_saver'
                                  ? 'border border-black text-black'
                                  : 'rounded-full bg-[#D95D39]/15 text-[#D95D39]'
                              }`}
                            >
                              <Flag className="h-3 w-3" />
                              {t.rules.priorityHigh}
                            </span>
                          )}
                        </div>

                        {rule.details && (
                          <p className="mt-1 text-xs leading-relaxed text-stone-600">
                            {rule.details}
                          </p>
                        )}

                        {showBadges && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {room === 'all' && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold ${themeClasses.badge}`}
                              >
                                <Icon className="h-3 w-3" />
                                {getCategoryLabel(rule.category, lang)}
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 text-[10px] font-semibold ${themeClasses.badge}`}
                            >
                              {getFrequencyLabel(rule.frequency, lang)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Poster Footer */}
              {showFooter && (
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 px-6 py-3.5 text-xs ${themeClasses.footer}`}
                >
                  <div className="font-medium">
                    {wg.members.join(' · ')}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] font-bold">
                    <span className="font-sans font-normal opacity-75">
                      {t.posters.wgCodeFooter}:
                    </span>
                    <span className="rounded border border-current px-2 py-0.5">
                      {wg.inviteCode}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
