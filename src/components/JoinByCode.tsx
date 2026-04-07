import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../atoms/sessionAtom'
import {
  activeTournamentAtom,
  tournamentsErrorAtom,
  currentViewAtom,
} from '../atoms/tournamentAtoms'
import { joinTournament, getTournamentById } from '../lib/tournamentService'
import styles from './JoinByCode.module.css'

interface JoinByCodeProps {
  onClose: () => void
}

function JoinByCode({ onClose }: JoinByCodeProps) {
  const user = useAtomValue(userAtom)
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setError = useSetAtom(tournamentsErrorAtom)
  const setCurrentView = useSetAtom(currentViewAtom)

  const [formData, setFormData] = useState({
    code: '',
    teamName: '',
  })
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!formData.code.trim()) {
      setLocalError('Código é obrigatório')
      return
    }

    if (!formData.teamName.trim()) {
      setLocalError('Nome do time é obrigatório')
      return
    }

    if (formData.code.length !== 6) {
      setLocalError('Código deve ter 6 caracteres')
      return
    }

    setLoading(true)

    try {
      // Entrar no torneio
      await joinTournament(formData.code, user.id, formData.teamName)

      // Buscar o torneio para setar como ativo
      const tournament = await getTournamentById(formData.code, user.id)
      setActiveTournament(tournament)

      // Mudar view para tournament
      setCurrentView('tournament')

      // Fechar modal
      onClose()
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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Entrar em um Torneio</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
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

          <div className={styles.formGroup}>
            <label htmlFor="teamName" className={styles.label}>
              Nome do Time / Apelido
            </label>
            <input
              id="teamName"
              type="text"
              name="teamName"
              value={formData.teamName}
              onChange={handleInputChange}
              placeholder="Ex: TimeBrasileiro"
              className={styles.input}
              disabled={loading}
              maxLength={50}
              required
            />
          </div>

          {localError && <div className={styles.errorMessage}>{localError}</div>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !formData.code.trim() || !formData.teamName.trim()}
            >
              {loading ? 'Entrando...' : 'Entrar no Torneio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default JoinByCode
