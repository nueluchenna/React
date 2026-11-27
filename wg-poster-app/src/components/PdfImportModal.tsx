import {
  AlertCircle,
  Check,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { db } from '../db'
import { CATEGORY_ORDER, getCategoryLabel, getCopy } from '../i18n'
import type { Language, ParsedRuleDraft, RuleCategory } from '../types'
import {
  extractTextFromPdf,
  parseRulesFromText,
  SAMPLE_WG_RULES,
} from '../utils/pdfParser'

interface PdfImportModalProps {
  lang: Language
  wgId: number
  onClose: () => void
  onImported: (count: number) => void
}

export function PdfImportModal({
  lang,
  wgId,
  onClose,
  onImported,
}: PdfImportModalProps) {
  const t = getCopy(lang)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [sourceFileName, setSourceFileName] = useState<string | undefined>()
  const [drafts, setDrafts] = useState<ParsedRuleDraft[] | null>(null)

  async function processPdfFile(file: File) {
    setError(null)
    setIsParsing(true)
    setSourceFileName(file.name)
    try {
      const text = await extractTextFromPdf(file)
      const parsed = parseRulesFromText(text)
      if (parsed.length === 0) {
        setError(t.pdf.noRulesFound)
        setDrafts(null)
      } else {
        setDrafts(parsed)
      }
    } catch {
      setError(t.pdf.errorReading)
      setDrafts(null)
    } finally {
      setIsParsing(false)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      void processPdfFile(file)
    } else if (file) {
      setError(t.pdf.errorReading)
    }
  }

  function handleParseText(input: string, label?: string) {
    setError(null)
    const parsed = parseRulesFromText(input)
    if (parsed.length === 0) {
      setError(t.pdf.noRulesFound)
      return
    }
    setSourceFileName(label)
    setDrafts(parsed)
  }

  function handleLoadSample() {
    const sample = SAMPLE_WG_RULES[lang]
    setPasteText(sample)
    handleParseText(
      sample,
      lang === 'de' ? 'Beispiel-WG-Regeln.pdf' : 'Sample-WG-Rules.pdf',
    )
  }

  function updateDraft(
    tempId: string,
    patch: Partial<Pick<ParsedRuleDraft, 'title' | 'category' | 'selected'>>,
  ) {
    setDrafts((prev) =>
      prev
        ? prev.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d))
        : prev,
    )
  }

  function setAllSelected(selected: boolean) {
    setDrafts((prev) => (prev ? prev.map((d) => ({ ...d, selected })) : prev))
  }

  async function handleConfirmImport() {
    if (!drafts) return
    const selected = drafts.filter((d) => d.selected && d.title.trim())
    if (selected.length === 0) return

    const now = Date.now()
    await db.rules.bulkAdd(
      selected.map((d, idx) => ({
        wgId,
        title: d.title.trim(),
        details: d.details?.trim() || undefined,
        category: d.category,
        frequency: d.frequency,
        priority: d.priority,
        completed: false,
        sourceFile: sourceFileName,
        createdAt: now + idx,
      })),
    )

    onImported(selected.length)
  }

  const selectedCount = drafts ? drafts.filter((d) => d.selected).length : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-[#FAF8F5] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D95D39]/15 text-[#D95D39]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900">
                {drafts ? t.pdf.reviewHeading : t.pdf.modalTitle}
              </h2>
              <p className="text-xs text-stone-500">
                {drafts ? t.pdf.reviewSubheading : t.pdf.modalSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isParsing ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#D95D39]" />
              <p className="mt-3 text-sm font-medium text-stone-700">
                {t.pdf.parsing}
              </p>
            </div>
          ) : !drafts ? (
            <div className="space-y-6">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-[#D95D39] bg-[#D95D39]/5'
                    : 'border-stone-300 bg-white hover:border-stone-400'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-stone-900">
                  {t.pdf.dropTitle}
                </p>
                <p className="mt-1 text-xs text-stone-500">{t.pdf.dropHint}</p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void processPdfFile(file)
                  }}
                />

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
                  >
                    {t.pdf.chooseFile}
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-[#FAF8F5] px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-[#D95D39] hover:text-[#D95D39]"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{t.pdf.loadSample}</span>
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-stone-200" />
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  {t.pdf.orPaste}
                </span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>

              {/* Text Paste Fallback */}
              <div>
                <textarea
                  rows={5}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={t.pdf.pastePlaceholder}
                  className="w-full rounded-2xl border border-stone-200 bg-white p-3.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={pasteText.trim().length < 8}
                    onClick={() => handleParseText(pasteText, 'Text-Import')}
                    className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.pdf.parseTextBtn}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  {sourceFileName && (
                    <span className="rounded-full bg-stone-200/70 px-2.5 py-1 font-medium text-stone-700">
                      {sourceFileName}
                    </span>
                  )}
                  <span>
                    {selectedCount} / {drafts.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllSelected(true)}
                    className="text-xs font-semibold text-stone-700 underline-offset-2 hover:underline"
                  >
                    {t.pdf.selectAll}
                  </button>
                  <span className="text-stone-300">·</span>
                  <button
                    type="button"
                    onClick={() => setAllSelected(false)}
                    className="text-xs font-semibold text-stone-500 underline-offset-2 hover:underline"
                  >
                    {t.pdf.deselectAll}
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {drafts.map((draft) => (
                  <div
                    key={draft.tempId}
                    className={`flex flex-col gap-2 rounded-2xl border p-3.5 transition-colors sm:flex-row sm:items-center ${
                      draft.selected
                        ? 'border-stone-300 bg-white'
                        : 'border-stone-200/70 bg-stone-100/60 opacity-60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft(draft.tempId, { selected: !draft.selected })
                      }
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        draft.selected
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 bg-white'
                      }`}
                      aria-label="Toggle rule selection"
                    >
                      {draft.selected && <Check className="h-3.5 w-3.5" />}
                    </button>

                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) =>
                        updateDraft(draft.tempId, { title: e.target.value })
                      }
                      className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-stone-900 focus:border-stone-300 focus:bg-[#FAF8F5] focus:outline-none"
                    />

                    <select
                      value={draft.category}
                      onChange={(e) =>
                        updateDraft(draft.tempId, {
                          category: e.target.value as RuleCategory,
                        })
                      }
                      className="rounded-lg border border-stone-200 bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-semibold text-stone-700 focus:border-stone-900 focus:outline-none"
                    >
                      {CATEGORY_ORDER.map((cat) => (
                        <option key={cat} value={cat}>
                          {getCategoryLabel(cat, lang)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {drafts && (
          <div className="flex items-center justify-between gap-3 border-t border-stone-200 bg-white px-6 py-4">
            <button
              type="button"
              onClick={() => {
                setDrafts(null)
                setError(null)
              }}
              className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              {t.pdf.backToUpload}
            </button>

            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => void handleConfirmImport()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#D95D39] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#c14f2d] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              <span>
                {t.pdf.importSelected} ({selectedCount})
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
