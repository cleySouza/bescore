import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

function clearBescoreCache(): void {
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('bescore.')) keysToRemove.push(key)
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info)
  }

  handleReset = (): void => {
    clearBescoreCache()
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f1116',
          color: '#fff',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '16px', color: '#aaa', maxWidth: '280px' }}>
          Algo deu errado. Tente atualizar o app.
        </p>
        <button
          onClick={this.handleReset}
          style={{
            padding: '12px 28px',
            borderRadius: '8px',
            border: 'none',
            background: '#5c2df5',
            color: '#fff',
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          Limpar cache e recarregar
        </button>
      </div>
    )
  }
}
