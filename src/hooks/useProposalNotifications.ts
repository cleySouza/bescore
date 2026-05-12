import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchParticipantPendingProposalNotifications,
  type ProposalNotificationRow,
} from '../lib/scoreProposalService'
import { supabase } from '../lib/supabaseClient'

function storageKey(userId: string): string {
  return `bescore.notificationsLastViewedAt.${userId}`
}

function readLastViewedAt(userId: string | undefined): string {
  if (!userId || typeof localStorage === 'undefined') return ''
  try {
    return localStorage.getItem(storageKey(userId)) ?? ''
  } catch {
    return ''
  }
}

export function useProposalNotifications(userId: string | undefined) {
  const [proposals, setProposals] = useState<ProposalNotificationRow[]>([])
  const [lastViewedAt, setLastViewedAt] = useState<string>(() => readLastViewedAt(userId))

  useEffect(() => {
    setLastViewedAt(readLastViewedAt(userId))
  }, [userId])

  const load = useCallback(async () => {
    if (!userId) {
      setProposals([])
      return
    }
    try {
      const rows = await fetchParticipantPendingProposalNotifications(userId)
      rows.sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))
      setProposals(rows)
    } catch (e) {
      console.error('useProposalNotifications load:', e)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!userId) return

    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleLoad = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        void load()
      }, 350)
    }

    const suffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    const channel = supabase
      .channel(`global-proposals:${suffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_score_proposals' },
        scheduleLoad
      )
      .subscribe()

    return () => {
      clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [userId, load])

  const markNotificationsViewed = useCallback(() => {
    const iso = new Date().toISOString()
    setLastViewedAt(iso)
    if (userId) {
      try {
        localStorage.setItem(storageKey(userId), iso)
      } catch {
        /* ignore quota / private mode */
      }
    }
  }, [userId])

  const unreadCount = useMemo(() => {
    const parsed = lastViewedAt ? Date.parse(lastViewedAt) : 0
    const thresholdMs = Number.isFinite(parsed) ? parsed : 0
    return proposals.reduce((acc, p) => {
      const t = Date.parse(p.created_at || '')
      return acc + (Number.isFinite(t) && t > thresholdMs ? 1 : 0)
    }, 0)
  }, [proposals, lastViewedAt])

  return { proposals, unreadCount, markNotificationsViewed, reload: load }
}
