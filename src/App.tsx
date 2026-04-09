import { useAtomValue } from 'jotai'
import { isAuthenticatedAtom } from './atoms/sessionAtom'
import { SignIn } from './screen/SingIn/SignIn'
import { LoggedIn } from './screen/LoggedIn/LoggedIn'

function App() {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)

  if (!isAuthenticated) {
    return <SignIn />
  }

  return <LoggedIn />
}

export default App
