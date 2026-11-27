import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type {
  Language,
  ParsedRuleDraft,
  RuleCategory,
  RuleFrequency,
  RulePriority,
} from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

const CATEGORY_KEYWORDS: Record<RuleCategory, RegExp[]> = {
  kitchen: [
    /\b(küche|kueche|spülmaschine|spuelmaschine|geschirr|herd|ofen|backofen|kühlschrank|kuehlschrank|arbeitsplatte|spüle|spuele|kochen|pfanne|topf|mikrowelle|kaffee|wasserkocher)\b/i,
    /\b(kitchen|dishwasher|dishes|stove|oven|fridge|refrigerator|counter|sink|cook|pan|pot|microwave|coffee)\b/i,
  ],
  bathroom: [
    /\b(bad|badezimmer|dusche|duschen|wc|toilette|waschbecken|abfluss|haare|schimmel|handtuch|handtücher|spiegel|lüften|lueften|klobrille|klobürste)\b/i,
    /\b(bath|bathroom|shower|toilet|drain|hair|mold|towel|mirror|ventilate|ventilation|soap)\b/i,
  ],
  trash: [
    /\b(müll|muell|biomüll|biomuell|restmüll|restmuell|altpapier|papier|gelber\s*sack|gelbe\s*tonne|wertstoff|pfand|altglas|glascontainer|kompost|trennen|mülltrennung|tonne)\b/i,
    /\b(trash|garbage|rubbish|waste|recycling|recycle|compost|bio|paper|plastic|bottle|bin|bins)\b/i,
  ],
  living: [
    /\b(wohnzimmer|flur|balkon|eingang|schuhe|saugen|staubsauger|wischen|sofa|couch|tisch|pflanzen|treppenhaus|putzplan|putzen)\b/i,
    /\b(living\s*room|hallway|balcony|entrance|shoes|vacuum|mop|sofa|couch|plants|stairway|cleaning\s*plan)\b/i,
  ],
  quiet: [
    /\b(ruhe|ruhezeit|nachtruhe|leise|musik|laut|lautstärke|gäste|gaeste|besuch|übernachtung|party|feiern|waschmaschine|home\s*office)\b/i,
    /\b(quiet|silence|noise|loud|music|guest|guests|visitor|overnight|party|sleep|night)\b/i,
  ],
  general: [
    /\b(tür|tuer|abschließen|schlüssel|schluessel|heizung|fenster|licht|strom|wlan|wifi|post|paket|einkauf|kasse|allgemein)\b/i,
    /\b(door|lock|key|keys|heating|window|light|electricity|wifi|mail|package|general)\b/i,
  ],
}

const HEADING_PATTERNS: { category: RuleCategory; pattern: RegExp }[] = [
  { category: 'kitchen', pattern: /^(#+\s*)?(küche|kueche|kitchen)\b/i },
  { category: 'bathroom', pattern: /^(#+\s*)?(bad|badezimmer|wc|bathroom)\b/i },
  {
    category: 'trash',
    pattern: /^(#+\s*)?(müll|muell|mülltrennung|recycling|trash|waste)\b/i,
  },
  {
    category: 'living',
    pattern:
      /^(#+\s*)?(wohnzimmer|flur|gemeinschaft|putzplan|living|hallway|common)/i,
  },
  {
    category: 'quiet',
    pattern: /^(#+\s*)?(ruhe|ruhezeit|gäste|besuch|quiet|guests)/i,
  },
  {
    category: 'general',
    pattern: /^(#+\s*)?(allgemein|sonstiges|hausordnung|general|other)/i,
  },
]

function detectHeadingCategory(line: string): RuleCategory | null {
  const cleaned = line.replace(/[:\-–—]+$/, '').trim()
  if (cleaned.length > 42 || cleaned.split(/\s+/).length > 5) return null
  for (const { category, pattern } of HEADING_PATTERNS) {
    if (pattern.test(cleaned)) return category
  }
  return null
}

export function classifyCategory(
  text: string,
  fallback: RuleCategory = 'general',
): RuleCategory {
  let bestCategory: RuleCategory = fallback
  let bestScore = 0

  for (const [category, patterns] of Object.entries(CATEGORY_KEYWORDS) as [
    RuleCategory,
    RegExp[],
  ][]) {
    let score = 0
    for (const regex of patterns) {
      const matches = text.match(new RegExp(regex.source, 'gi'))
      if (matches) score += matches.length
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  return bestCategory
}

export function detectFrequency(text: string): RuleFrequency {
  if (
    /\b(täglich|taeglich|jeden\s*tag|nach\s*jedem|sofort|direkt|immer|über\s*nacht|abends|morgens|daily|every\s*day|after\s*every|immediately|overnight)\b/i.test(
      text,
    )
  ) {
    return 'daily'
  }
  if (
    /\b(wöchentlich|woechentlich|jede\s*woche|einmal\s*pro\s*woche|sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|putzplan|rotation|weekly|every\s*week|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(
      text,
    )
  ) {
    return 'weekly'
  }
  return 'as_needed'
}

export function detectPriority(text: string): RulePriority {
  if (
    /!|\b(wichtig|pflicht|unbedingt|niemals|nie|kein|keine|verboten|achtung|important|never|always|must|no\s+\w+\s+in)\b/i.test(
      text,
    )
  ) {
    return 'high'
  }
  return 'normal'
}

function cleanLine(line: string): string {
  return line
    .replace(/^\s*(?:[-•●▪◦*–—]|\d+[.)]|[a-zA-Z][.)]|\[[ xX]?\])\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseRulesFromText(rawText: string): ParsedRuleDraft[] {
  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const drafts: ParsedRuleDraft[] = []
  let activeSection: RuleCategory = 'general'
  const seen = new Set<string>()

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]

    // Skip obvious document titles or page numbers
    if (/^(seite|page)\s*\d+(\s*\/\s*\d+)?$/i.test(line)) continue
    if (/^(wg-regeln|hausordnung|house\s*rules|putzplan)\s*$/i.test(line)) {
      continue
    }

    const headingCategory = detectHeadingCategory(line)
    if (headingCategory) {
      activeSection = headingCategory
      continue
    }

    const cleaned = cleanLine(line)
    if (cleaned.length < 8) continue

    const normalizedKey = cleaned.toLowerCase()
    if (seen.has(normalizedKey)) continue
    seen.add(normalizedKey)

    // Split optional detail after " — " or " - " if the first part is substantial
    let title = cleaned
    let details: string | undefined
    const dashSplit = cleaned.split(/\s+[—–]\s+/)
    if (dashSplit.length >= 2 && dashSplit[0].length >= 16) {
      title = dashSplit[0].trim()
      details = dashSplit.slice(1).join(' — ').trim()
    }

    const category = classifyCategory(cleaned, activeSection)
    const frequency = detectFrequency(cleaned)
    const priority = detectPriority(cleaned)

    drafts.push({
      tempId: `draft-${i}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      details,
      category,
      frequency,
      priority,
      selected: true,
    })
  }

  return drafts
}

interface PositionedItem {
  str: string
  x: number
  y: number
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: buffer })
  const pdf = await loadingTask.promise

  const pageTexts: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    const items: PositionedItem[] = []
    for (const item of content.items) {
      if ('str' in item && item.str.trim().length > 0) {
        const tx = item.transform
        items.push({
          str: item.str,
          x: tx[4],
          y: tx[5],
        })
      }
    }

    // Group items by similar Y coordinate (within ~4pt tolerance)
    items.sort((a, b) => b.y - a.y || a.x - b.x)
    const lines: PositionedItem[][] = []

    for (const item of items) {
      const lastLine = lines[lines.length - 1]
      if (lastLine && Math.abs(lastLine[0].y - item.y) <= 4.5) {
        lastLine.push(item)
      } else {
        lines.push([item])
      }
    }

    const pageLines = lines.map((lineItems) => {
      lineItems.sort((a, b) => a.x - b.x)
      return lineItems
        .map((it) => it.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    })

    pageTexts.push(pageLines.join('\n'))
  }

  return pageTexts.join('\n')
}

export const SAMPLE_WG_RULES: Record<Language, string> = {
  de: `WG-Regeln & Putzplan

Küche:
- Spülmaschine sofort einräumen und nicht über Nacht Geschirr in der Spüle lassen!
- Herd, Arbeitsplatte und Esstisch nach jedem Kochen feucht abwischen.
- Kühlschrank jeden Sonntag gemeinsam auf abgelaufene Sachen prüfen.
- Kaffeemaschine nach Benutzung ausspülen und Kaffeesatz in den Biomüll geben.

Müll & Trennung:
- Biomüll alle 2 Tage in die braune Tonne bringen — kein Plastik verwenden!
- Gelber Sack (Verpackungen) und Altpapier sauber trennen, Kartons flach falten.
- Pfandflaschen in die Kiste im Flur stellen; wer einkauft, nimmt eine Tasche mit.

Bad:
- Nach dem Duschen 5 Minuten Stoßlüften und Duschwand abziehen (Schimmel vermeiden!).
- Haare nach dem Duschen direkt aus dem Abfluss-Sieb entfernen.
- Bad-Putzplan wechselt jeden Sonntagabend (Waschbecken, Dusche, WC, Boden).

Ruhezeit & Gäste:
- Nachtruhe unter der Woche ab 22:30 Uhr — Waschmaschine nicht nach 21 Uhr starten.
- Übernachtungsgäste ab 2 Nächten bitte kurz in der WG-Gruppe ankündigen.

Wohnzimmer & Flur:
- Schuhe auf dem Regal neben der Tür abstellen und Flur wöchentlich saugen.`,
  en: `WG House Rules & Cleaning Plan

Kitchen:
- Load the dishwasher right away — never leave dirty dishes in the sink overnight!
- Wipe down the stove, counter, and dining table after every meal.
- Weekly Sunday fridge check: toss expired food and wipe shelves.
- Rinse the coffee maker after use and empty grounds into the bio bin.

Trash & Recycling:
- Take bio waste down every 2 days — no plastic bags in the bio bin!
- Separate recycling (yellow bin) and paper, and flatten all cardboard boxes.
- Store deposit bottles (Pfand) in the hallway crate for the next grocery run.

Bathroom:
- Open the window for 5 minutes and squeegee the shower glass after every shower!
- Clear hair from the shower drain immediately after use.
- Weekly bathroom cleaning rotation switches every Sunday evening.

Quiet Hours & Guests:
- Quiet hours on weeknights start at 22:30 — no washing machine after 21:00.
- Let the WG chat know if overnight guests are staying more than 2 nights.

Living Room & Hallway:
- Leave shoes on the entryway rack and vacuum the hallway once a week.`,
}
