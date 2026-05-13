import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  displayAvatarUrl,
  displayName,
  PROFILE_NICKNAME_MAX,
  updateMyProfile,
  uploadMyAvatar,
  type ProfileRow,
} from '../../lib/profileService'
import styles from './ProfileEditor.module.css'

interface ProfileEditorProps {
  user: User
  profile: ProfileRow | null
  onSaved: () => void
}

export function ProfileEditor({ user, profile, onSaved }: ProfileEditorProps) {
  const fileInputId = useId()
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewRevokeRef = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNickname(profile?.nickname ?? '')
  }, [profile?.nickname])

  useEffect(() => {
    return () => {
      if (previewRevokeRef.current) {
        URL.revokeObjectURL(previewRevokeRef.current)
      }
    }
  }, [])

  const effectiveAvatarPreview =
    previewUrl ?? displayAvatarUrl(user, profile)

  const googleOnlyAvatar =
    typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : ''

  const hasCustomAvatarInDb = !!(profile?.avatar_url?.trim())

  const pickFile = () => {
    setError(null)
    const input = document.getElementById(fileInputId) as HTMLInputElement | null
    input?.click()
  }

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setPendingFile(file)
    if (previewRevokeRef.current) {
      URL.revokeObjectURL(previewRevokeRef.current)
    }
    const url = URL.createObjectURL(file)
    previewRevokeRef.current = url
    setPreviewUrl(url)
  }

  const clearPendingPreview = () => {
    setPendingFile(null)
    if (previewRevokeRef.current) {
      URL.revokeObjectURL(previewRevokeRef.current)
      previewRevokeRef.current = null
    }
    setPreviewUrl(null)
  }

  const handleRemoveStoredAvatar = async () => {
    setError(null)
    setBusy(true)
    try {
      await updateMyProfile(user.id, { avatar_url: null })
      clearPendingPreview()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover foto')
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    setError(null)
    setBusy(true)
    try {
      let avatarUrl: string | undefined
      if (pendingFile) {
        avatarUrl = await uploadMyAvatar(user.id, pendingFile)
      }

      const trimmed = nickname.trim()
      const nicknameValue = trimmed.length > 0 ? trimmed.slice(0, PROFILE_NICKNAME_MAX) : null

      await updateMyProfile(user.id, {
        nickname: nicknameValue,
        ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      })

      clearPendingPreview()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar perfil')
    } finally {
      setBusy(false)
    }
  }

  const fallbackLetter = displayName(user, profile).charAt(0).toUpperCase()

  return (
    <section className={styles.section} aria-labelledby={`${fileInputId}-title`}>
      <h2 id={`${fileInputId}-title`} className={styles.sectionTitle}>
        Perfil público
      </h2>

      <div className={styles.avatarRow}>
        {effectiveAvatarPreview ? (
          <img src={effectiveAvatarPreview} alt="" className={styles.preview} />
        ) : (
          <span className={styles.previewFallback} aria-hidden="true">
            {fallbackLetter}
          </span>
        )}
        <div className={styles.avatarActions}>
          <input
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={styles.fileInput}
            onChange={onFileChange}
            aria-label="Escolher foto de perfil"
          />
          <button type="button" className={styles.secondaryBtn} onClick={pickFile} disabled={busy}>
            {pendingFile ? 'Alterar foto escolhida' : 'Escolher nova foto'}
          </button>
          {pendingFile ? (
            <button type="button" className={styles.linkBtn} onClick={clearPendingPreview} disabled={busy}>
              Cancelar foto nova
            </button>
          ) : null}
          {!pendingFile && hasCustomAvatarInDb ? (
            <button type="button" className={styles.linkBtn} onClick={handleRemoveStoredAvatar} disabled={busy}>
              Voltar à foto do Google
            </button>
          ) : null}
          {!pendingFile && !hasCustomAvatarInDb && googleOnlyAvatar ? (
            <p className={styles.hint}>A usar foto da conta Google. Carrega uma imagem para substituir.</p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor={`${fileInputId}-nick`} className={styles.fieldLabel}>
          Apelido (nickname)
        </label>
        <input
          id={`${fileInputId}-nick`}
          type="text"
          className={styles.textInput}
          maxLength={PROFILE_NICKNAME_MAX}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Opcional — substitui o nome da conta nos torneios"
          disabled={busy}
          autoComplete="nickname"
        />
        <p className={styles.hint}>
          O nome da conta (Google) fica guardado no perfil. Se definir um apelido, é esse que aparece nos torneios e
          listas. Até {PROFILE_NICKNAME_MAX} caracteres.
        </p>
      </div>

      {error ? (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}

      <button type="button" className={styles.primaryBtn} onClick={handleSave} disabled={busy}>
        {busy ? 'A guardar…' : 'Guardar perfil'}
      </button>
    </section>
  )
}
