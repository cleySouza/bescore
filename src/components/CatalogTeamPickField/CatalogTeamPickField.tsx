import { useState } from 'react'
import { TeamSelectModal } from '../../screen/CreateTournament/components/TeamSelectModal/TeamSelectModal'
import type { Club } from '../../lib/strapiClubService'

export type CatalogClubPick = Pick<Club, 'id' | 'name'>

interface CatalogTeamPickFieldProps {
  value: CatalogClubPick | null
  onChange: (club: CatalogClubPick | null) => void
  takenTeamNames: string[]
  disabled?: boolean
  triggerClassName?: string
  placeholder?: string
}

export function CatalogTeamPickField({
  value,
  onChange,
  takenTeamNames,
  disabled = false,
  triggerClassName = '',
  placeholder = 'Escolher time no catálogo…',
}: CatalogTeamPickFieldProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {value ? value.name : placeholder}
      </button>
      {open && (
        <TeamSelectModal
          key={value?.id ?? 'new'}
          selectedIds={value ? [value.id] : []}
          maxTeams={1}
          excludedClubNames={takenTeamNames}
          onConfirm={(clubs) => {
            const c = clubs[0]
            if (c) onChange({ id: c.id, name: c.name })
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
