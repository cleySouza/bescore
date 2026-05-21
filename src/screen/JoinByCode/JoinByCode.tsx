import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import { activeTournamentAtom, tournamentsErrorAtom } from '../../atoms/tournamentAtoms'
import { paths, tournamentEntryPath } from '../../app/navigation/paths'
import {
  getTournamentByCode,
  getTournamentById,
  getTournamentParticipants,
  joinTournament,
} from '../../lib/tournamentService'
import type { TournamentSettings } from '../../types/tournament'
import { CatalogTeamPickField, type CatalogClubPick } from '../../components/CatalogTeamPickField/CatalogTeamPickField'
import { HiOutlineArrowLeft } from 'react-icons/hi2'
import styles from './JoinByCode.module.css'

type InviteTournament = Awaited<ReturnType<typeof getTournamentByCode>>

function JoinByCode() {
  const user = useAtomValue(userAtom)
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setError = useSetAtom(tournamentsErrorAtom)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [formData, setFormData] = useState({
    code: '',
  })
  const [previewTournament, setPreviewTournament] = useState<InviteTournament>(null)
  const [availableTeams, setAvailableTeams] = useState<string[]>([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [takenTeamNamesForJoin, setTakenTeamNamesForJoin] = useState<string[]>([])
  const [catalogJoinClub, setCatalogJoinClub] = useState<CatalogClubPick | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const previewSettings = (previewTournament?.settings as TournamentSettings | null) ?? null
  const predefinedTeamNames = Array.isArray(previewSettings?.selectedTeamNames)
    ? previewSettings.selectedTeamNames.filter(
        (name): name is string => typeof name === 'string' && name.trim().length > 0
      )
    : []
  const hasPredefinedTeams = predefinedTeamNames.length > 0
  const isAutoPredefined = hasPredefinedTeams && (previewSettings?.teamAssignMode ?? 'auto') === 'auto'
  const isManualPredefined = hasPredefinedTeams && (previewSettings?.teamAssignMode ?? 'auto') === 'manual'
  const shouldPickFromCatalog = !hasPredefinedTeams

  const joinTeamName = useMemo(() => {
    if (isAutoPredefined) return ''
    if (isManualPredefined) return selectedTeam
    return catalogJoinClub?.name.trim() ?? ''
  }, [catalogJoinClub, isAutoPredefined, isManualPredefined, selectedTeam])

  useEffect(() => {
    const inviteCode = formData.code.trim()
    if (inviteCode.length !== 6) {
      setPreviewTournament(null)
      setAvailableTeams([])
      setSelectedTeam('')
      setTakenTeamNamesForJoin([])
      setCatalogJoinClub(null)
      return
    }

    let cancelled = false

    const loadPreview = async () => {
      setLoadingPreview(true)
      try {
        const tournament = await getTournamentByCode(inviteCode)
        if (!tournament || cancelled) {
          if (!cancelled) {
            setPreviewTournament(null)
            setAvailableTeams([])
            setSelectedTeam('')
            setTakenTeamNamesForJoin([])
            setCatalogJoinClub(null)
          }
          return
        }

        setPreviewTournament(tournament)
        const settings = (tournament.settings as TournamentSettings | null) ?? null
        const selectedTeamNames = Array.isArray(settings?.selectedTeamNames)
          ? settings.selectedTeamNames.filter(
              (name): name is string => typeof name === 'string' && name.trim().length > 0
            )
          : []
        const isManual = (settings?.teamAssignMode ?? 'auto') === 'manual'

        let participants: Awaited<ReturnType<typeof getTournamentParticipants>> = []
        try {
          participants = await getTournamentParticipants(tournament.id)
        } catch {
          participants = []
        }
        if (cancelled) return

        const taken = participants
          .map((p) => (p.team_name ?? '').trim())
          .filter((name) => name.length > 0)
        const takenSet = new Set(taken)

        setTakenTeamNamesForJoin(taken)

        if (isManual && selectedTeamNames.length > 0) {
          const available = selectedTeamNames.filter((name) => !takenSet.has(name))
          setAvailableTeams(available)
          setSelectedTeam((current) => (available.includes(current) ? current : ''))
        } else {
          setAvailableTeams([])
          setSelectedTeam('')
        }

        setCatalogJoinClub((current) => {
          if (!current) return null
          return takenSet.has(current.name.trim()) ? null : current
        })
      } catch {
        if (!cancelled) {
          setPreviewTournament(null)
          setAvailableTeams([])
          setSelectedTeam('')
          setTakenTeamNamesForJoin([])
          setCatalogJoinClub(null)
        }
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }

    loadPreview()

    return () => {
      cancelled = true
    }
  }, [formData.code])

  useEffect(() => {
    const invite = searchParams.get('invite')?.trim().toUpperCase()
    if (invite && invite.length === 6) {
      setFormData((prev) => ({ ...prev, code: invite }))
    }
  }, [searchParams])

  if (!user) {
    return null
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value.toUpperCase(),
    }))
    setLocalError(null)
  }

  const handleBack = () => {
    navigate(paths.home)
    setFormData({ code: '' })
    setPreviewTournament(null)
    setAvailableTeams([])
    setSelectedTeam('')
    setTakenTeamNamesForJoin([])
    setCatalogJoinClub(null)
    setLocalError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!formData.code.trim()) {
      setLocalError('Código é obrigatório')
      return
    }

    if (formData.code.length !== 6) {
      setLocalError('Código deve ter 6 caracteres')
      return
    }

    try {
      const tournament = previewTournament ?? await getTournamentByCode(formData.code)
      if (!tournament) {
        setLocalError('Código de convite inválido ou não encontrado')
        return
      }

      if (isManualPredefined && availableTeams.length === 0) {
        setLocalError('Não há times disponíveis neste torneio no momento')
        return
      }

      if (isManualPredefined && !selectedTeam) {
        setLocalError('Selecione um time para participar')
        return
      }

      if (shouldPickFromCatalog && !catalogJoinClub?.name.trim()) {
        setLocalError('Escolha um time no catálogo para participar')
        return
      }

      setLoading(true)

      // Entrar no torneio
      await joinTournament(formData.code, user.id, joinTeamName)

      // Buscar o torneio para setar como ativo
      const detailedTournament = await getTournamentById(tournament.id, user.id)
      setActiveTournament(detailedTournament)

      navigate(tournamentEntryPath(detailedTournament.id, detailedTournament.status))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar no torneio'
      setLocalError(message)
      setError(message)
      console.error('Erro:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={handleBack} aria-label="Voltar">
          <HiOutlineArrowLeft aria-hidden size={18} strokeWidth={2} />
          Voltar
        </button>
        <h1 className={styles.title}>Entrar em um Torneio</h1>
        <div style={{ width: '60px' }} />
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="code" className={styles.label}>
            Código de Convite
          </label>
          <input
            id="code"
            type="text"
            name="code"
            value={formData.code}
            onChange={handleInputChange}
            placeholder="Ex: ABC123"
            className={styles.input}
            disabled={loading}
            maxLength={6}
            required
          />
          <small className={styles.hint}>Solicite o código de um organizador</small>
        </div>

        {loadingPreview && formData.code.trim().length === 6 && (
          <div className={styles.hint}>Validando convite...</div>
        )}

        {isManualPredefined && (
          <div className={styles.formGroup}>
            <label htmlFor="selectedTeam" className={styles.label}>
              Escolha seu time
            </label>
            <select
              id="selectedTeam"
              className={styles.input}
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              disabled={loading || availableTeams.length === 0}
            >
              <option value="">Selecione um time...</option>
              {availableTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
            {availableTeams.length === 0 && (
              <small className={styles.hint}>Sem times disponíveis no momento.</small>
            )}
          </div>
        )}

        {isAutoPredefined && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Time</label>
            <input
              className={styles.input}
              value="Definido automaticamente pelo organizador"
              disabled
              readOnly
            />
            <small className={styles.hint}>Basta confirmar a participação.</small>
          </div>
        )}

        {shouldPickFromCatalog && (
          <div className={styles.formGroup}>
            <span className={styles.label}>Escolha seu time</span>
            <CatalogTeamPickField
              value={catalogJoinClub}
              onChange={setCatalogJoinClub}
              takenTeamNames={takenTeamNamesForJoin}
              disabled={loading || loadingPreview || !previewTournament}
              triggerClassName={`${styles.input} ${styles.catalogPickTrigger}`}
              placeholder="Abrir catálogo de clubes…"
            />
            <small className={styles.hint}>
              Escolha um clube do catálogo — o mesmo fluxo de “definir times” na criação.
            </small>
          </div>
        )}

        {localError && <div className={styles.errorMessage}>{localError}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={handleBack}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={
              loading ||
              loadingPreview ||
              !formData.code.trim() ||
              (shouldPickFromCatalog && !catalogJoinClub) ||
              (isManualPredefined && !selectedTeam)
            }
          >
            {loading ? 'Entrando...' : 'Entrar no Torneio'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default JoinByCode
