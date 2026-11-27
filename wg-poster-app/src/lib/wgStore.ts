import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'
import { db, ensureSeedData } from '../db'
import type {
  RuleCategory,
  RuleFrequency,
  RulePriority,
  WgProfile,
  WgRule,
} from '../types'
import { isSupabaseConfigured, supabase } from './supabase'

const JOINED_WGS_KEY = 'wg-kompass-joined-wgs'

function readJoinedIds(): Set<number> {
  try {
    const raw = window.localStorage.getItem(JOINED_WGS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((n): n is number => typeof n === 'number'))
  } catch {
    return new Set()
  }
}

function writeJoinedIds(ids: Set<number>) {
  window.localStorage.setItem(JOINED_WGS_KEY, JSON.stringify([...ids]))
}

interface SupabaseWgRow {
  id: number
  name: string
  city: string
  district: string
  invite_code: string
  members: string[]
  description: string
  created_at: string
}

interface SupabaseRuleRow {
  id: number
  wg_id: number
  title: string
  details: string | null
  category: RuleCategory
  frequency: RuleFrequency
  priority: RulePriority
  completed: boolean
  source_file: string | null
  created_at: string
}

function mapWgRow(row: SupabaseWgRow, joinedIds: Set<number>): WgProfile {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    district: row.district,
    inviteCode: row.invite_code,
    members: Array.isArray(row.members) ? row.members : [],
    description: row.description ?? '',
    joined: joinedIds.has(row.id),
    createdAt: Date.parse(row.created_at) || Date.now(),
  }
}

function mapRuleRow(row: SupabaseRuleRow): WgRule {
  return {
    id: row.id,
    wgId: row.wg_id,
    title: row.title,
    details: row.details ?? undefined,
    category: row.category,
    frequency: row.frequency,
    priority: row.priority,
    completed: row.completed,
    sourceFile: row.source_file ?? undefined,
    createdAt: Date.parse(row.created_at) || Date.now(),
  }
}

export function getWgCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const queryCode = params.get('wg')?.trim()
  if (queryCode) return queryCode.toUpperCase()

  const match = window.location.pathname.match(/^\/wg\/([^/]+)$/i)
  if (match?.[1]) return decodeURIComponent(match[1]).toUpperCase()
  return null
}

export function setWgCodeInUrl(inviteCode: string) {
  const url = new URL(window.location.href)
  if (url.pathname.startsWith('/wg/')) {
    url.pathname = '/'
  }
  url.searchParams.set('wg', inviteCode)
  window.history.replaceState({}, '', url.toString())
}

export function buildShareableWgUrl(inviteCode: string): string {
  const url = new URL(window.location.origin)
  url.searchParams.set('wg', inviteCode)
  return url.toString()
}

export interface CreateWgInput {
  name: string
  city: string
  district: string
  inviteCode: string
  members: string[]
  description: string
}

export type NewRuleInput = Omit<WgRule, 'id' | 'createdAt'>

export type RuleUpdatePatch = Partial<
  Pick<
    WgRule,
    'title' | 'details' | 'category' | 'frequency' | 'priority' | 'completed'
  >
>

export interface WgDataStore {
  mode: 'supabase' | 'local'
  ready: boolean
  syncError: string | null
  wgs: WgProfile[]
  rules: WgRule[]
  createWg: (input: CreateWgInput) => Promise<number | undefined>
  setWgJoined: (wgId: number, joined: boolean) => Promise<void>
  addRule: (input: NewRuleInput) => Promise<void>
  addRulesBulk: (inputs: NewRuleInput[]) => Promise<void>
  updateRule: (ruleId: number, patch: RuleUpdatePatch) => Promise<void>
  deleteRule: (ruleId: number) => Promise<void>
  resetCompletedRules: (wgId: number) => Promise<void>
}

export function useWgData(): WgDataStore {
  const [localReady, setLocalReady] = useState(false)
  const [cloudReady, setCloudReady] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [cloudWgs, setCloudWgs] = useState<WgProfile[]>([])
  const [cloudRules, setCloudRules] = useState<WgRule[]>([])

  // Local Dexie mode
  useEffect(() => {
    if (isSupabaseConfigured) return
    void ensureSeedData().then(() => setLocalReady(true))
  }, [])

  const dexieWgs = useLiveQuery(
    () =>
      isSupabaseConfigured
        ? Promise.resolve([] as WgProfile[])
        : db.wgs.toArray(),
    [],
    [] as WgProfile[],
  )
  const dexieRules = useLiveQuery(
    () =>
      isSupabaseConfigured
        ? Promise.resolve([] as WgRule[])
        : db.rules.toArray(),
    [],
    [] as WgRule[],
  )

  const refreshCloud = useCallback(async () => {
    if (!supabase) return
    const [wgsRes, rulesRes] = await Promise.all([
      supabase
        .from('wgs')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('rules')
        .select('*')
        .order('created_at', { ascending: false }),
    ])

    if (wgsRes.error) {
      setSyncError(wgsRes.error.message)
      setCloudReady(true)
      return
    }
    if (rulesRes.error) {
      setSyncError(rulesRes.error.message)
      setCloudReady(true)
      return
    }

    const joinedIds = readJoinedIds()
    setCloudWgs(
      ((wgsRes.data ?? []) as SupabaseWgRow[]).map((row) =>
        mapWgRow(row, joinedIds),
      ),
    )
    setCloudRules(((rulesRes.data ?? []) as SupabaseRuleRow[]).map(mapRuleRow))
    setSyncError(null)
    setCloudReady(true)
  }, [])

  // Supabase initial fetch + Realtime subscriptions
  useEffect(() => {
    if (!supabase) return

    let active = true
    const init = async () => {
      await Promise.resolve()
      if (active) await refreshCloud()
    }
    void init()

    const channel = supabase
      .channel('wg-kompass-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wgs' },
        () => {
          void refreshCloud()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rules' },
        () => {
          void refreshCloud()
        },
      )
      .subscribe()

    return () => {
      active = false
      void supabase?.removeChannel(channel)
    }
  }, [refreshCloud])

  const createWg = useCallback(
    async (input: CreateWgInput): Promise<number | undefined> => {
      if (supabase) {
        const { data, error } = await supabase
          .from('wgs')
          .insert({
            name: input.name,
            city: input.city,
            district: input.district,
            invite_code: input.inviteCode,
            members: input.members,
            description: input.description,
          })
          .select('id')
          .single()

        if (error) {
          setSyncError(error.message)
          return undefined
        }

        const newId = (data as { id: number }).id
        const joinedIds = readJoinedIds()
        joinedIds.add(newId)
        writeJoinedIds(joinedIds)
        await refreshCloud()
        return newId
      }

      return db.wgs.add({
        ...input,
        joined: true,
        createdAt: Date.now(),
      })
    },
    [refreshCloud],
  )

  const setWgJoined = useCallback(async (wgId: number, joined: boolean) => {
    if (supabase) {
      const joinedIds = readJoinedIds()
      if (joined) joinedIds.add(wgId)
      else joinedIds.delete(wgId)
      writeJoinedIds(joinedIds)
      setCloudWgs((prev) =>
        prev.map((w) => (w.id === wgId ? { ...w, joined } : w)),
      )
      return
    }
    await db.wgs.update(wgId, { joined })
  }, [])

  const addRule = useCallback(
    async (input: NewRuleInput) => {
      if (supabase) {
        const { error } = await supabase.from('rules').insert({
          wg_id: input.wgId,
          title: input.title,
          details: input.details ?? null,
          category: input.category,
          frequency: input.frequency,
          priority: input.priority,
          completed: input.completed,
          source_file: input.sourceFile ?? null,
        })
        if (error) setSyncError(error.message)
        else await refreshCloud()
        return
      }
      await db.rules.add({ ...input, createdAt: Date.now() })
    },
    [refreshCloud],
  )

  const addRulesBulk = useCallback(
    async (inputs: NewRuleInput[]) => {
      if (inputs.length === 0) return
      if (supabase) {
        const { error } = await supabase.from('rules').insert(
          inputs.map((item) => ({
            wg_id: item.wgId,
            title: item.title,
            details: item.details ?? null,
            category: item.category,
            frequency: item.frequency,
            priority: item.priority,
            completed: item.completed,
            source_file: item.sourceFile ?? null,
          })),
        )
        if (error) setSyncError(error.message)
        else await refreshCloud()
        return
      }
      const now = Date.now()
      await db.rules.bulkAdd(
        inputs.map((item, idx) => ({ ...item, createdAt: now + idx })),
      )
    },
    [refreshCloud],
  )

  const updateRule = useCallback(
    async (ruleId: number, patch: RuleUpdatePatch) => {
      if (supabase) {
        const payload: Record<string, unknown> = {}
        if (patch.title !== undefined) payload.title = patch.title
        if (patch.details !== undefined) payload.details = patch.details ?? null
        if (patch.category !== undefined) payload.category = patch.category
        if (patch.frequency !== undefined) payload.frequency = patch.frequency
        if (patch.priority !== undefined) payload.priority = patch.priority
        if (patch.completed !== undefined) payload.completed = patch.completed

        const { error } = await supabase
          .from('rules')
          .update(payload)
          .eq('id', ruleId)
        if (error) setSyncError(error.message)
        else await refreshCloud()
        return
      }
      await db.rules.update(ruleId, patch)
    },
    [refreshCloud],
  )

  const deleteRule = useCallback(
    async (ruleId: number) => {
      if (supabase) {
        const { error } = await supabase.from('rules').delete().eq('id', ruleId)
        if (error) setSyncError(error.message)
        else await refreshCloud()
        return
      }
      await db.rules.delete(ruleId)
    },
    [refreshCloud],
  )

  const resetCompletedRules = useCallback(
    async (wgId: number) => {
      if (supabase) {
        const { error } = await supabase
          .from('rules')
          .update({ completed: false })
          .eq('wg_id', wgId)
          .eq('completed', true)
        if (error) setSyncError(error.message)
        else await refreshCloud()
        return
      }
      const completed = await db.rules
        .where('wgId')
        .equals(wgId)
        .filter((r) => r.completed)
        .toArray()
      await Promise.all(
        completed
          .filter((r) => r.id != null)
          .map((r) => db.rules.update(r.id!, { completed: false })),
      )
    },
    [refreshCloud],
  )

  return {
    mode: isSupabaseConfigured ? 'supabase' : 'local',
    ready: isSupabaseConfigured ? cloudReady : localReady,
    syncError,
    wgs: isSupabaseConfigured ? cloudWgs : dexieWgs,
    rules: isSupabaseConfigured ? cloudRules : dexieRules,
    createWg,
    setWgJoined,
    addRule,
    addRulesBulk,
    updateRule,
    deleteRule,
    resetCompletedRules,
  }
}
