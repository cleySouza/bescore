import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { userAtom } from '../../atoms/sessionAtom'
import {
  myTournamentsAtom,
  tournamentsErrorAtom,
  activeTournamentAtom,
  currentViewAtom,
} from '../../atoms/tournamentAtoms'
import { createTournament, fetchMyTournaments, getTournamentById } from '../../lib/tournamentService'
import styles from './CreateTournament.module.css'

function CreateTournament() {
  const user = useAtomValue(userAtom)
  const setMyTournaments = useSetAtom(myTournamentsAtom)
  const setError = useSetAtom(tournamentsErrorAtom)
  const setActiveTournament = useSetAtom(activeTournamentAtom)
  const setCurrentView = useSetAtom(currentViewAtom)

  const [formData, setFormData] = useState({
    name: '',
    gameType: 'eFootball',
  })
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!user) {
    return null
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    setLocalError(null)
  }

  const handleBack = () => {
    setCurrentView('dashboard')
    setFormData({ name: '', gameType: 'eFootball' })
    setLocalError(null)
    setSuccess(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    // Validação
    if (!formData.name.trim()) {
      setLocalError('Nome do torneio é obrigatório')
      return
    }

    if (formData.name.length < 3) {
      setLocalError('Nome deve ter pelo menos 3 caracteres')
      return
    }

    setLoading(true)

    try {
      // Criar torneio
      const newTournament = await createTournament(formData.name, user.id, formData.gameType)
      setSuccess(true)

      // Recarregar lista de torneios
      const tournaments = await fetchMyTournaments(user.id)
      setMyTournaments(tournaments)

      // Buscar o torneio com detalhes e setar como ativo
      const tournamentWithDetails = await getTournamentById(newTournament.id, user.id)
      setActiveTournament(tournamentWithDetails)

      // Mudar view para tournament
      setTimeout(() => {
        setCurrentView('tournament')
      }, 1500)

      // Limpar formulário
      setFormData({ name: '', gameType: 'eFootball' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar torneio'
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
          ← Voltar
        </button>
        <h1 className={styles.title}>Criar Novo Torneio</h1>
        <div style={{ width: '60px' }} />
      </div>

      {success ? (
        <div className={styles.successContainer}>
          <div className={styles.successIcon}>✅</div>
          <p className={styles.successMessage}>Torneio criado com sucesso!</p>
          <small>Redirecionando...</small>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.label}>
              Nome do Torneio
            </label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Ex: Copa eFootball Brasil"
              className={styles.input}
              disabled={loading}
              maxLength={100}
              required
            />
            <small className={styles.hint}>Máximo 100 caracteres</small>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="gameType" className={styles.label}>
              Tipo de Jogo
            </label>
            <select
              id="gameType"
              name="gameType"
              value={formData.gameType}
              onChange={handleInputChange}
              className={styles.select}
              disabled={loading}
            >
              <option value="eFootball">⚽ eFootball (EA Sports FC)</option>
              <option value="LoL">🎮 League of Legends</option>
              <option value="CS2">🔫 Counter-Strike 2</option>
              <option value="Valorant">🔴 Valorant</option>
              <option value="Outros">❓ Outros</option>
            </select>
          </div>

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
              disabled={loading || !formData.name.trim()}
            >
              {loading ? 'Criando...' : 'Criar Torneio'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default CreateTournament
