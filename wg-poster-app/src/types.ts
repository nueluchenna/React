export type Language = 'de' | 'en'

export type AppTab = 'rules' | 'posters' | 'directory'

export type RuleCategory =
  | 'kitchen'
  | 'bathroom'
  | 'trash'
  | 'living'
  | 'quiet'
  | 'general'

export type RuleFrequency = 'daily' | 'weekly' | 'as_needed'

export type RulePriority = 'high' | 'normal'

export interface WgProfile {
  id?: number
  name: string
  city: string
  district: string
  inviteCode: string
  members: string[]
  description: string
  joined: boolean
  createdAt: number
}

export interface WgRule {
  id?: number
  wgId: number
  title: string
  details?: string
  category: RuleCategory
  frequency: RuleFrequency
  priority: RulePriority
  completed: boolean
  sourceFile?: string
  createdAt: number
}

export type PosterFormat = 'poster_a4' | 'card_a5' | 'stickers'

export type PosterTheme = 'bauhaus' | 'warm_kitchen' | 'ink_saver'

export interface ParsedRuleDraft {
  tempId: string
  title: string
  details?: string
  category: RuleCategory
  frequency: RuleFrequency
  priority: RulePriority
  selected: boolean
}
