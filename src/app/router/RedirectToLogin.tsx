import { Navigate, useLocation } from 'react-router-dom'

/** Utilizador não autenticado: envia para /login mantendo query string (ex.: invite). */
export function RedirectToLogin() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/login', search }} replace />
}
