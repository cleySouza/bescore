import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSetAtom } from 'jotai'
import { globalToastAtom } from '../atoms/tournamentAtoms'
import {
  fetchParticipantProposalNotificationFeed,
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
  const setGlobalToast = useSetAtom(globalToastAtom)
  const [proposals, setProposals] = useState<ProposalNotificationRow[]>([])
  const [lastViewedAt, setLastViewedAt] = useState<string>(() => readLastViewedAt(userId))
  /** Primeiro fetch: baseline só de IDs pendentes para não disparar toast ao abrir o app */
  const seededBaselineRef = useRef(false)
  const knownPendingIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    setLastViewedAt(readLastViewedAt(userId))
    seededBaselineRef.current = false
    knownPendingIdsRef.current = new Set()
  }, [userId])

  const load = useCallback(async () => {
    if (!userId) {
      setProposals([])
      return
    }
    try {
      const rows = await fetchParticipantProposalNotificationFeed(userId)
      const pendingRows = rows.filter((r) => r.status === 'pending')

      if (!seededBaselineRef.current) {
        seededBaselineRef.current = true
        knownPendingIdsRef.current = new Set(pendingRows.map((r) => r.id))
        setProposals(rows)
        return
      }

      const prev = knownPendingIdsRef.current
      const hasNewPending = pendingRows.some((r) => !prev.has(r.id))
      if (hasNewPending) {
        setGlobalToast({
          type: 'info',
          message: 'Nova proposta de placar — abra Notificações ou a partida para votar.',
          persist: true,
        })
      }

      knownPendingIdsRef.current = new Set(pendingRows.map((r) => r.id))
      setProposals(rows)
    } catch (e) {
      console.error('useProposalNotifications load:', e)
    }
  }, [userId, setGlobalToast])

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
      if (p.status !== 'pending') return acc
      const t = Date.parse(p.created_at || '')
      return acc + (Number.isFinite(t) && t > thresholdMs ? 1 : 0)
    }, 0)
  }, [proposals, lastViewedAt])

  return { proposals, unreadCount, markNotificationsViewed, reload: load }
}
