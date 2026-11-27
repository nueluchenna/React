import {
  Bath,
  Home,
  Moon,
  Sofa,
  Trash2,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { RuleCategory } from '../types'

export interface CategoryMeta {
  icon: LucideIcon
  chipBg: string
  chipText: string
  chipBorder: string
  accentHex: string
  softHex: string
}

export const CATEGORY_META: Record<RuleCategory, CategoryMeta> = {
  kitchen: {
    icon: UtensilsCrossed,
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-900',
    chipBorder: 'border-amber-200',
    accentHex: '#D95D39',
    softHex: '#FEF3EC',
  },
  bathroom: {
    icon: Bath,
    chipBg: 'bg-sky-50',
    chipText: 'text-sky-900',
    chipBorder: 'border-sky-200',
    accentHex: '#2B6CB0',
    softHex: '#EBF5FF',
  },
  trash: {
    icon: Trash2,
    chipBg: 'bg-emerald-50',
    chipText: 'text-emerald-900',
    chipBorder: 'border-emerald-200',
    accentHex: '#2F6F55',
    softHex: '#ECF7F1',
  },
  living: {
    icon: Sofa,
    chipBg: 'bg-orange-50',
    chipText: 'text-orange-900',
    chipBorder: 'border-orange-200',
    accentHex: '#C47D1A',
    softHex: '#FEF7E7',
  },
  quiet: {
    icon: Moon,
    chipBg: 'bg-indigo-50',
    chipText: 'text-indigo-900',
    chipBorder: 'border-indigo-200',
    accentHex: '#4338CA',
    softHex: '#EEF2FF',
  },
  general: {
    icon: Home,
    chipBg: 'bg-stone-100',
    chipText: 'text-stone-800',
    chipBorder: 'border-stone-300',
    accentHex: '#44403C',
    softHex: '#F5F5F4',
  },
}
