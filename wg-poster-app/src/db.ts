import Dexie, { type EntityTable } from 'dexie'
import type { WgProfile, WgRule } from './types'

class WgPosterDatabase extends Dexie {
  wgs!: EntityTable<WgProfile, 'id'>
  rules!: EntityTable<WgRule, 'id'>

  constructor() {
    super('WgKompassDB')
    this.version(1).stores({
      wgs: '++id, name, city, inviteCode, joined',
      rules: '++id, wgId, category, frequency, priority, completed, createdAt',
    })
  }
}

export const db = new WgPosterDatabase()

let seedPromise: Promise<void> | null = null

export function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existingCount = await db.wgs.count()
      if (existingCount > 0) return

      const now = Date.now()

      const wg1Id = await db.wgs.add({
        name: 'Sonnenallee 42 WG',
        city: 'Berlin',
        district: 'Neukölln',
        inviteCode: 'SONNE-42',
        members: ['Hannah', 'Lukas', 'Mina', 'Tobias'],
        description:
          '4er-Altbau-WG mit großer Wohnküche, Balkon und entspanntem Putzplan.',
        joined: true,
        createdAt: now - 1000 * 60 * 60 * 24 * 14,
      })

      const wg2Id = await db.wgs.add({
        name: 'Schanzen-WG',
        city: 'Hamburg',
        district: 'Sternschanze',
        inviteCode: 'SCHANZE-08',
        members: ['Jule', 'Matteo', 'Nora'],
        description:
          '3er-WG direkt am Schulterblatt — klare Mülltrennung & sonntags gemeinsamer Kaffee.',
        joined: false,
        createdAt: now - 1000 * 60 * 60 * 24 * 10,
      })

      const wg3Id = await db.wgs.add({
        name: 'Glockenbach Loft',
        city: 'München',
        district: 'Glockenbachviertel',
        inviteCode: 'GLOCKE-19',
        members: ['Felix', 'Amelie', 'Kian', 'Svenja'],
        description:
          '4er-WG im Dachgeschoss mit Home-Office-Tagen und ruhigen Nächten unter der Woche.',
        joined: false,
        createdAt: now - 1000 * 60 * 60 * 24 * 5,
      })

      if (wg1Id == null || wg2Id == null || wg3Id == null) return

      const seedRules: Omit<WgRule, 'id'>[] = [
        // Sonnenallee 42 WG
        {
          wgId: wg1Id,
          title: 'Spülmaschine direkt einräumen — kein Geschirr über Nacht in der Spüle',
          details: 'Wer sie morgens sauber sieht, räumt sie kurz aus.',
          category: 'kitchen',
          frequency: 'daily',
          priority: 'high',
          completed: false,
          sourceFile: 'WG-Regeln-Sonnenallee.pdf',
          createdAt: now - 9000,
        },
        {
          wgId: wg1Id,
          title: 'Herd & Arbeitsplatte nach dem Kochen feucht abwischen',
          details: 'Mikrofasertuch hängt rechts am Haken, Spray steht unter der Spüle.',
          category: 'kitchen',
          frequency: 'daily',
          priority: 'normal',
          completed: true,
          sourceFile: 'WG-Regeln-Sonnenallee.pdf',
          createdAt: now - 8500,
        },
        {
          wgId: wg1Id,
          title: 'Kühlschrank-Check jeden Sonntag: abgelaufene Lebensmittel entsorgen',
          details: 'Jede Person hat ein eigenes Fach; oberstes Fach ist Gemeinschaft.',
          category: 'kitchen',
          frequency: 'weekly',
          priority: 'normal',
          completed: false,
          sourceFile: 'WG-Regeln-Sonnenallee.pdf',
          createdAt: now - 8000,
        },
        {
          wgId: wg1Id,
          title: 'Biomüll alle 2 Tage runterbringen (braune Tonne im Hinterhof)',
          details: 'Nur Papiertüten verwenden — kein Plastik in den Biomüll!',
          category: 'trash',
          frequency: 'daily',
          priority: 'high',
          completed: false,
          sourceFile: 'WG-Regeln-Sonnenallee.pdf',
          createdAt: now - 7500,
        },
        {
          wgId: wg1Id,
          title: 'Gelber Sack / Wertstoffe & Altpapier sauber trennen und falten',
          details: 'Kartons bitte flach drücken, Pfandflaschen in die Kiste im Flur.',
          category: 'trash',
          frequency: 'as_needed',
          priority: 'normal',
          completed: false,
          sourceFile: 'WG-Regeln-Sonnenallee.pdf',
          createdAt: now - 7000,
        },
        {
          wgId: wg1Id,
          title: 'Nach dem Duschen 5 Min. Stoßlüften & Glaswand abziehen',
          details: 'Beugt Schimmel und Kalkflecken vor.',
          category: 'bathroom',
          frequency: 'daily',
          priority: 'high',
          completed: true,
          sourceFile: 'WG-Regeln-Sonnenallee.pdf',
          createdAt: now - 6500,
        },
        {
          wgId: wg1Id,
          title: 'Abfluss-Sieb in der Dusche nach Gebrauch von Haaren befreien',
          category: 'bathroom',
          frequency: 'daily',
          priority: 'normal',
          completed: false,
          sourceFile: 'WG-Regeln-Sonnenallee.pdf',
          createdAt: now - 6000,
        },
        {
          wgId: wg1Id,
          title: 'Nachtruhe unter der Woche ab 22:30 Uhr (So–Do)',
          details: 'Musik/Filme leiser stellen und Waschmaschine nicht nach 21 Uhr starten.',
          category: 'quiet',
          frequency: 'daily',
          priority: 'high',
          completed: false,
          sourceFile: 'WG-Regeln-Sonnenallee.pdf',
          createdAt: now - 5500,
        },
        {
          wgId: wg1Id,
          title: 'Übernachtungsgäste ab 2 Nächten kurz in der WG-Gruppe ankündigen',
          category: 'quiet',
          frequency: 'as_needed',
          priority: 'normal',
          completed: false,
          sourceFile: 'WG-Regeln-Sonnenallee.pdf',
          createdAt: now - 5000,
        },
        {
          wgId: wg1Id,
          title: 'Flur & Wohnzimmer einmal pro Woche saugen (laut Putzplan-Rotation)',
          details: 'Schuhe bitte auf das Regal neben der Eingangstür stellen.',
          category: 'living',
          frequency: 'weekly',
          priority: 'normal',
          completed: false,
          sourceFile: 'WG-Regeln-Sonnenallee.pdf',
          createdAt: now - 4500,
        },
        {
          wgId: wg1Id,
          title: 'Wohnungstür ab 22 Uhr immer einmal abschließen',
          category: 'general',
          frequency: 'daily',
          priority: 'normal',
          completed: false,
          sourceFile: 'WG-Regeln-Sonnenallee.pdf',
          createdAt: now - 4000,
        },

        // Schanzen-WG
        {
          wgId: wg2Id,
          title: 'Siebträger-Kaffeemaschine nach jedem Bezug kurz durchspülen',
          category: 'kitchen',
          frequency: 'daily',
          priority: 'high',
          completed: false,
          createdAt: now - 3500,
        },
        {
          wgId: wg2Id,
          title: 'Gelbe Tonne wird dienstags abgeholt — Montagabend rausstellen',
          category: 'trash',
          frequency: 'weekly',
          priority: 'high',
          completed: false,
          createdAt: now - 3000,
        },
        {
          wgId: wg2Id,
          title: 'Bad-Putzplan wechselt jeden Sonntagabend',
          category: 'bathroom',
          frequency: 'weekly',
          priority: 'normal',
          completed: false,
          createdAt: now - 2500,
        },

        // Glockenbach Loft
        {
          wgId: wg3Id,
          title: 'Home-Office-Ruhe Mo–Fr 9:00–17:00 Uhr bei geschlossener Zimmertür',
          category: 'quiet',
          frequency: 'daily',
          priority: 'high',
          completed: false,
          createdAt: now - 2000,
        },
        {
          wgId: wg3Id,
          title: 'Altglas einmal pro Woche zum Container an der Fraunhoferstraße bringen',
          category: 'trash',
          frequency: 'weekly',
          priority: 'normal',
          completed: false,
          createdAt: now - 1500,
        },
      ]

      await db.rules.bulkAdd(seedRules)
    })()
  }
  return seedPromise
}
