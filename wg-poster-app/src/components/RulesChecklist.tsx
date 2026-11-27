import {
  Check,
  FileUp,
  Flag,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import {
  CATEGORY_ORDER,
  getCategoryLabel,
  getCopy,
  getFrequencyLabel,
} from '../i18n'
import type { NewRuleInput, RuleUpdatePatch } from '../lib/wgStore'
import type {
  Language,
  RuleCategory,
  RuleFrequency,
  RulePriority,
  WgProfile,
  WgRule,
} from '../types'
import { CATEGORY_META } from '../utils/categoryMeta'
import { PdfImportModal } from './PdfImportModal'

interface RulesChecklistProps {
  lang: Language
  wg: WgProfile
  rules: WgRule[]
  onAddRule: (rule: NewRuleInput) => Promise<void>
  onAddRulesBulk: (rules: NewRuleInput[]) => Promise<void>
  onUpdateRule: (ruleId: number, patch: RuleUpdatePatch) => Promise<void>
  onDeleteRule: (ruleId: number) => Promise<void>
  onResetCompleted: (wgId: number) => Promise<void>
  onOpenPosterForRoom: (room: RuleCategory | 'all') => void
}

export function RulesChecklist({
  lang,
  wg,
  rules,
  onAddRule,
  onAddRulesBulk,
  onUpdateRule,
  onDeleteRule,
  onResetCompleted,
  onOpenPosterForRoom,
}: RulesChecklistProps) {
  const t = getCopy(lang)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<
    RuleCategory | 'all'
  >('all')
  const [selectedFrequency, setSelectedFrequency] = useState<
    RuleFrequency | 'all'
  >('all')
  const [importantOnly, setImportantOnly] = useState(false)

  const [showPdfModal, setShowPdfModal] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [importBanner, setImportBanner] = useState<string | null>(null)

  // Add form state
  const [newTitle, setNewTitle] = useState('')
  const [newDetails, setNewDetails] = useState('')
  const [newCategory, setNewCategory] = useState<RuleCategory>('kitchen')
  const [newFrequency, setNewFrequency] = useState<RuleFrequency>('daily')
  const [newPriority, setNewPriority] = useState<RulePriority>('normal')

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDetails, setEditDetails] = useState('')
  const [editCategory, setEditCategory] = useState<RuleCategory>('kitchen')
  const [editFrequency, setEditFrequency] = useState<RuleFrequency>('daily')

  const categoryCounts = useMemo(() => {
    const counts: Record<RuleCategory, number> = {
      kitchen: 0,
      bathroom: 0,
      trash: 0,
      living: 0,
      quiet: 0,
      general: 0,
    }
    for (const rule of rules) {
      counts[rule.category] += 1
    }
    return counts
  }, [rules])

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rules.filter((rule) => {
      if (selectedCategory !== 'all' && rule.category !== selectedCategory) {
        return false
      }
      if (selectedFrequency !== 'all' && rule.frequency !== selectedFrequency) {
        return false
      }
      if (importantOnly && rule.priority !== 'high') {
        return false
      }
      if (!q) return true
      return (
        rule.title.toLowerCase().includes(q) ||
        (rule.details?.toLowerCase().includes(q) ?? false) ||
        getCategoryLabel(rule.category, lang).toLowerCase().includes(q)
      )
    })
  }, [rules, search, selectedCategory, selectedFrequency, importantOnly, lang])

  const completedCount = rules.filter((r) => r.completed).length

  async function handleAddRule(e: FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || wg.id == null) return

    await onAddRule({
      wgId: wg.id,
      title: newTitle.trim(),
      details: newDetails.trim() || undefined,
      category: newCategory,
      frequency: newFrequency,
      priority: newPriority,
      completed: false,
    })

    setNewTitle('')
    setNewDetails('')
    setNewPriority('normal')
    setShowAddForm(false)
  }

  async function handleToggleComplete(rule: WgRule) {
    if (rule.id == null) return
    await onUpdateRule(rule.id, { completed: !rule.completed })
  }

  async function handleTogglePriority(rule: WgRule) {
    if (rule.id == null) return
    await onUpdateRule(rule.id, {
      priority: rule.priority === 'high' ? 'normal' : 'high',
    })
  }

  async function handleDelete(rule: WgRule) {
    if (rule.id == null) return
    await onDeleteRule(rule.id)
  }

  function startEditing(rule: WgRule) {
    if (rule.id == null) return
    setEditingId(rule.id)
    setEditTitle(rule.title)
    setEditDetails(rule.details ?? '')
    setEditCategory(rule.category)
    setEditFrequency(rule.frequency)
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (editingId == null || !editTitle.trim()) return
    await onUpdateRule(editingId, {
      title: editTitle.trim(),
      details: editDetails.trim() || undefined,
      category: editCategory,
      frequency: editFrequency,
    })
    setEditingId(null)
  }

  async function handleResetChecks() {
    if (wg.id == null) return
    await onResetCompleted(wg.id)
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              {wg.name} · {wg.district}, {wg.city}
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-stone-900">
            {t.rules.heading}
          </h1>
          <p className="mt-1 text-sm text-stone-600">{t.rules.subheading}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPdfModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#D95D39] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#c14f2d]"
          >
            <FileUp className="h-4 w-4" />
            <span>{t.rules.uploadPdf}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAddForm((prev) => !prev)
              if (selectedCategory !== 'all') setNewCategory(selectedCategory)
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-900 hover:bg-stone-50"
          >
            <Plus className="h-4 w-4" />
            <span>{t.rules.addRule}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenPosterForRoom(selectedCategory)}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-stone-800"
          >
            <Printer className="h-4 w-4" />
            <span>{t.rules.makePoster}</span>
          </button>
        </div>
      </div>

      {/* Import Success Toast */}
      {importBanner && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>{importBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportBanner(null)}
            className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Quick Add Rule Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddRule}
          className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t.rules.ruleTitlePlaceholder}
                className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-4 py-2.5 text-sm font-medium text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <input
                type="text"
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                placeholder={t.rules.ruleDetailsPlaceholder}
                className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-4 py-2 text-sm text-stone-700 focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as RuleCategory)}
                className="rounded-xl border border-stone-200 bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-stone-700 focus:border-stone-900 focus:outline-none"
              >
                {CATEGORY_ORDER.map((cat) => (
                  <option key={cat} value={cat}>
                    {getCategoryLabel(cat, lang)}
                  </option>
                ))}
              </select>

              <select
                value={newFrequency}
                onChange={(e) =>
                  setNewFrequency(e.target.value as RuleFrequency)
                }
                className="rounded-xl border border-stone-200 bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-stone-700 focus:border-stone-900 focus:outline-none"
              >
                <option value="daily">{getFrequencyLabel('daily', lang)}</option>
                <option value="weekly">
                  {getFrequencyLabel('weekly', lang)}
                </option>
                <option value="as_needed">
                  {getFrequencyLabel('as_needed', lang)}
                </option>
              </select>

              <button
                type="button"
                onClick={() =>
                  setNewPriority((p) => (p === 'high' ? 'normal' : 'high'))
                }
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  newPriority === 'high'
                    ? 'border-[#D95D39] bg-[#D95D39]/10 text-[#D95D39]'
                    : 'border-stone-200 bg-[#FAF8F5] text-stone-600'
                }`}
              >
                <Flag className="h-3.5 w-3.5" />
                <span>{t.rules.priorityHigh}</span>
              </button>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-xl border border-stone-200 px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  {t.rules.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800"
                >
                  {t.rules.save}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Search + Filters */}
      <div className="mt-6 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.rules.searchPlaceholder}
              className="w-full rounded-2xl border border-stone-200 bg-white py-2.5 pr-4 pl-11 text-sm text-stone-900 shadow-xs placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedFrequency}
              onChange={(e) =>
                setSelectedFrequency(e.target.value as RuleFrequency | 'all')
              }
              className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-semibold text-stone-700 shadow-xs focus:border-stone-900 focus:outline-none"
            >
              <option value="all">{getFrequencyLabel('all', lang)}</option>
              <option value="daily">{getFrequencyLabel('daily', lang)}</option>
              <option value="weekly">{getFrequencyLabel('weekly', lang)}</option>
              <option value="as_needed">
                {getFrequencyLabel('as_needed', lang)}
              </option>
            </select>

            <button
              type="button"
              onClick={() => setImportantOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold shadow-xs transition-colors ${
                importantOnly
                  ? 'border-[#D95D39] bg-[#D95D39] text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              <span>{t.rules.importantOnly}</span>
            </button>

            {completedCount > 0 && (
              <button
                type="button"
                onClick={() => void handleResetChecks()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-semibold text-stone-600 shadow-xs transition-colors hover:border-stone-400 hover:text-stone-900"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t.rules.resetChecks}</span>
              </button>
            )}
          </div>
        </div>

        {/* Room Category Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              selectedCategory === 'all'
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
            }`}
          >
            <span>{getCategoryLabel('all', lang)}</span>
            <span className="opacity-70">{rules.length}</span>
          </button>

          {CATEGORY_ORDER.map((cat) => {
            const Icon = CATEGORY_META[cat].icon
            const isSelected = selectedCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  isSelected
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{getCategoryLabel(cat, lang)}</span>
                <span className="opacity-65">{categoryCounts[cat]}</span>
              </button>
            )
          })}

          <div className="ml-auto hidden text-xs font-medium text-stone-500 sm:block">
            {completedCount}/{rules.length} {t.rules.checkedCount}
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="mt-6 space-y-2.5">
        {filteredRules.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-14 text-center">
            <p className="font-display text-lg font-bold text-stone-900">
              {t.rules.emptyTitle}
            </p>
            <p className="mt-1 text-sm text-stone-500">{t.rules.emptyDesc}</p>
            <div className="mt-5 flex justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#D95D39] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c14f2d]"
              >
                <FileUp className="h-4 w-4" />
                <span>{t.rules.uploadPdf}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:border-stone-900"
              >
                <Plus className="h-4 w-4" />
                <span>{t.rules.addRule}</span>
              </button>
            </div>
          </div>
        ) : (
          filteredRules.map((rule) => {
            const meta = CATEGORY_META[rule.category]
            const CategoryIcon = meta.icon
            const isEditing = editingId === rule.id

            if (isEditing) {
              return (
                <form
                  key={rule.id}
                  onSubmit={saveEdit}
                  className="rounded-2xl border border-stone-900 bg-white p-4 shadow-sm"
                >
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3.5 py-2 text-sm font-medium text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editDetails}
                      onChange={(e) => setEditDetails(e.target.value)}
                      placeholder={t.rules.ruleDetailsPlaceholder}
                      className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3.5 py-2 text-xs text-stone-700 focus:border-stone-900 focus:bg-white focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={editCategory}
                        onChange={(e) =>
                          setEditCategory(e.target.value as RuleCategory)
                        }
                        className="rounded-lg border border-stone-200 bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-semibold text-stone-700"
                      >
                        {CATEGORY_ORDER.map((cat) => (
                          <option key={cat} value={cat}>
                            {getCategoryLabel(cat, lang)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editFrequency}
                        onChange={(e) =>
                          setEditFrequency(e.target.value as RuleFrequency)
                        }
                        className="rounded-lg border border-stone-200 bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-semibold text-stone-700"
                      >
                        <option value="daily">
                          {getFrequencyLabel('daily', lang)}
                        </option>
                        <option value="weekly">
                          {getFrequencyLabel('weekly', lang)}
                        </option>
                        <option value="as_needed">
                          {getFrequencyLabel('as_needed', lang)}
                        </option>
                      </select>
                      <div className="ml-auto flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600"
                        >
                          {t.rules.cancel}
                        </button>
                        <button
                          type="submit"
                          className="rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-semibold text-white"
                        >
                          {t.rules.save}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )
            }

            return (
              <div
                key={rule.id}
                className={`group flex items-start gap-3.5 rounded-2xl border bg-white p-4 transition-all ${
                  rule.completed
                    ? 'border-stone-200/70 bg-stone-50/70'
                    : 'border-stone-200 hover:border-stone-300 hover:shadow-xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void handleToggleComplete(rule)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    rule.completed
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-stone-300 bg-white hover:border-stone-900'
                  }`}
                  aria-label="Toggle completed"
                >
                  {rule.completed && <Check className="h-3.5 w-3.5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold leading-snug ${
                      rule.completed
                        ? 'text-stone-400 line-through'
                        : 'text-stone-900'
                    }`}
                  >
                    {rule.title}
                  </p>
                  {rule.details && (
                    <p
                      className={`mt-1 text-xs leading-relaxed ${
                        rule.completed ? 'text-stone-400' : 'text-stone-600'
                      }`}
                    >
                      {rule.details}
                    </p>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.chipBg} ${meta.chipText} ${meta.chipBorder}`}
                    >
                      <CategoryIcon className="h-3 w-3" />
                      {getCategoryLabel(rule.category, lang)}
                    </span>

                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
                      {getFrequencyLabel(rule.frequency, lang)}
                    </span>

                    {rule.priority === 'high' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#D95D39]/12 px-2.5 py-0.5 text-[11px] font-semibold text-[#D95D39]">
                        <Flag className="h-3 w-3" />
                        {t.rules.priorityHigh}
                      </span>
                    )}

                    {rule.sourceFile && (
                      <span className="rounded-full border border-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-400">
                        {t.rules.fromPdf}: {rule.sourceFile}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row Actions */}
                <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => void handleTogglePriority(rule)}
                    title={t.rules.priorityHigh}
                    className={`rounded-lg p-1.5 transition-colors ${
                      rule.priority === 'high'
                        ? 'text-[#D95D39] hover:bg-[#D95D39]/10'
                        : 'text-stone-400 hover:bg-stone-100 hover:text-stone-700'
                    }`}
                  >
                    <Flag className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditing(rule)}
                    title={t.rules.edit}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(rule)}
                    title={t.rules.delete}
                    className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* PDF Importer Modal */}
      {showPdfModal && wg.id != null && (
        <PdfImportModal
          lang={lang}
          wgId={wg.id}
          onAddRulesBulk={onAddRulesBulk}
          onClose={() => setShowPdfModal(false)}
          onImported={(count) => {
            setShowPdfModal(false)
            setImportBanner(
              lang === 'de'
                ? `${count} Regeln erfolgreich aus dem PDF importiert.`
                : `Successfully imported ${count} rules from your PDF.`,
            )
          }}
        />
      )}
    </section>
  )
}
