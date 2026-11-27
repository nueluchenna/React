import {
  ArrowRight,
  Building2,
  Check,
  KeyRound,
  MapPin,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { db } from '../db'
import { getCopy } from '../i18n'
import type { Language, WgProfile } from '../types'

interface WgDirectoryProps {
  lang: Language
  wgs: WgProfile[]
  ruleCountByWg: Record<number, number>
  activeWgId: number | null
  onSelectWg: (wgId: number) => void
}

function generateInviteCode(name: string): string {
  const prefix =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6) || 'WG'
  const suffix = Math.floor(10 + Math.random() * 89)
  return `${prefix}-${suffix}`
}

export function WgDirectory({
  lang,
  wgs,
  ruleCountByWg,
  activeWgId,
  onSelectWg,
}: WgDirectoryProps) {
  const t = getCopy(lang)
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  // New WG form state
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [membersInput, setMembersInput] = useState('')
  const [description, setDescription] = useState('')

  const filteredWgs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return wgs
    return wgs.filter(
      (wg) =>
        wg.name.toLowerCase().includes(q) ||
        wg.city.toLowerCase().includes(q) ||
        wg.district.toLowerCase().includes(q) ||
        wg.inviteCode.toLowerCase().includes(q),
    )
  }, [wgs, query])

  const joinedWgs = filteredWgs.filter((wg) => wg.joined)
  const discoverWgs = filteredWgs.filter((wg) => !wg.joined)

  async function handleJoinAndOpen(wg: WgProfile) {
    if (wg.id == null) return
    if (!wg.joined) {
      await db.wgs.update(wg.id, { joined: true })
    }
    onSelectWg(wg.id)
  }

  async function handleLeave(wg: WgProfile) {
    if (wg.id == null) return
    await db.wgs.update(wg.id, { joined: false })
  }

  async function handleCreateWg(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !city.trim()) return

    const members = membersInput
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)

    const id = await db.wgs.add({
      name: name.trim(),
      city: city.trim(),
      district: district.trim() || 'Zentrum',
      inviteCode: generateInviteCode(name),
      members: members.length > 0 ? members : ['Du'],
      description:
        description.trim() ||
        (lang === 'de'
          ? 'Unsere gemeinsame WG auf WG-Kompass.'
          : 'Our shared flat on WG-Kompass.'),
      joined: true,
      createdAt: Date.now(),
    })

    setName('')
    setCity('')
    setDistrict('')
    setMembersInput('')
    setDescription('')
    setShowCreate(false)
    if (id != null) {
      onSelectWg(id)
    }
  }

  function renderWgCard(wg: WgProfile) {
    const id = wg.id ?? -1
    const isActive = id === activeWgId
    const rulesCount = ruleCountByWg[id] ?? 0

    return (
      <div
        key={id}
        className={`group flex flex-col justify-between rounded-2xl border bg-white p-5 transition-all ${
          isActive
            ? 'border-stone-900 ring-2 ring-stone-900/10'
            : 'border-stone-200 hover:border-stone-300 hover:shadow-sm'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isActive
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-700'
                }`}
              >
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold leading-snug text-stone-900">
                  {wg.name}
                </h3>
                <div className="flex items-center gap-1 text-xs text-stone-500">
                  <MapPin className="h-3.5 w-3.5 text-[#D95D39]" />
                  <span>
                    {wg.district}, {wg.city}
                  </span>
                </div>
              </div>
            </div>

            {isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white">
                <Check className="h-3 w-3" />
                {t.directory.activeBadge}
              </span>
            ) : wg.joined ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                {t.directory.joinedBadge}
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            {wg.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-600">
            <span className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1 font-medium">
              <Users className="h-3.5 w-3.5 text-stone-500" />
              {wg.members.length} {t.directory.membersLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1 font-medium">
              {rulesCount} {t.directory.rulesLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-stone-300 bg-[#FAF8F5] px-2.5 py-1 font-mono text-[11px] font-semibold text-stone-700">
              <KeyRound className="h-3 w-3 text-[#D95D39]" />
              {wg.inviteCode}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {wg.members.map((member) => (
              <span
                key={member}
                className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-xs text-stone-600"
              >
                {member}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-stone-100 pt-4">
          {wg.joined ? (
            <>
              <button
                type="button"
                onClick={() => handleJoinAndOpen(wg)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
              >
                <span>{t.directory.openBtn}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              {!isActive && (
                <button
                  type="button"
                  onClick={() => handleLeave(wg)}
                  className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  {t.directory.leaveBtn}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleJoinAndOpen(wg)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#D95D39] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c14f2d]"
            >
              <Plus className="h-4 w-4" />
              <span>{t.directory.joinBtn}</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-stone-900">
            {t.directory.heading}
          </h1>
          <p className="mt-1.5 text-sm text-stone-600">
            {t.directory.subheading}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate((prev) => !prev)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-stone-800"
        >
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{t.directory.createBtn}</span>
        </button>
      </div>

      {/* Create New WG Form */}
      {showCreate && (
        <form
          onSubmit={handleCreateWg}
          className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        >
          <h2 className="font-display text-xl font-bold text-stone-900">
            {t.directory.createTitle}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t.directory.nameLabel} *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.directory.namePlaceholder}
                className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t.directory.cityLabel} *
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t.directory.cityPlaceholder}
                className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t.directory.districtLabel}
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder={t.directory.districtPlaceholder}
                className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t.directory.membersInputLabel}
              </label>
              <input
                type="text"
                value={membersInput}
                onChange={(e) => setMembersInput(e.target.value)}
                placeholder={t.directory.membersPlaceholder}
                className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t.directory.descLabel}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.directory.descPlaceholder}
                className="w-full rounded-xl border border-stone-200 bg-[#FAF8F5] px-3.5 py-2 text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              {t.rules.cancel}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#D95D39] px-5 py-2 text-sm font-semibold text-white hover:bg-[#c14f2d]"
            >
              {t.directory.createSubmit}
            </button>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.directory.searchPlaceholder}
          className="w-full rounded-2xl border border-stone-200 bg-white py-3 pr-4 pl-11 text-sm text-stone-900 shadow-xs placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
        />
      </div>

      {/* Results */}
      {filteredWgs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-sm text-stone-500">
          {t.directory.noMatches}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {joinedWgs.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">
                {t.directory.myWgs} ({joinedWgs.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {joinedWgs.map(renderWgCard)}
              </div>
            </div>
          )}

          {discoverWgs.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">
                {t.directory.discoverWgs} ({discoverWgs.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {discoverWgs.map(renderWgCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
