import { useEffect, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { userAtom } from '../../atoms/sessionAtom'
import { activeTournamentAtom, tournamentsErrorAtom } from '../../atoms/tournamentAtoms'
import { getTournamentByCode, getTournamentById } from '../../lib/tournamentService'
import { paths, tournamentEntryPath } from '../navigation/paths'

/**
 * Links antigos (?invite=CODE na home ou outras páginas) abrem o torneio diretamente.
 * Em /join o fluxo manual permanece na página de entrada por código.
 */
export function InviteDeepLinkHandler() {
  const user = useAtomValue(userAtom)
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteRaw = searchParams.get('invite')
  const inviteCode = inviteRaw?.trim().toUpperCase() ?? ''
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setTournamentError = useSetAtom(tournamentsErrorAtom)
  const lastHandledInviteRef = useRef<string | null>(null)

  useEffect(() => {
    if (!inviteCode || inviteCode.length !== 6 || !user) return
    if (location.pathname.startsWith(paths.join)) return
    if (lastHandledInviteRef.current === inviteCode) return

    let cancelled = false

    const run = async () => {
      try {
        const tournament = await getTournamentByCode(inviteCode)
        if (!tournament || cancelled) return

        const detailed = await getTournamentById(tournament.id, user.id)
        if (cancelled) return

        lastHandledInviteRef.current = inviteCode
        setActiveTournament(detailed)

        navigate(tournamentEntryPath(detailed.id, detailed.status), { replace: true })
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Convite inválido'
        setTournamentError(message)
        navigate(`${paths.join}?invite=${encodeURIComponent(inviteCode)}`, { replace: true })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [user, location.pathname, inviteCode, navigate, setActiveTournament, setTournamentError])

  return null
}
