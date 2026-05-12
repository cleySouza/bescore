export function RouteSpinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="app-loading-screen" role="status" aria-label={label}>
      <div className="app-loading-spinner" aria-hidden="true" />
    </div>
  )
}
