import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ScoreEntryDrawerBoundaryProps {
  children: ReactNode
}

interface ScoreEntryDrawerBoundaryState {
  hasError: boolean
}

class ScoreEntryDrawerBoundary extends Component<ScoreEntryDrawerBoundaryProps, ScoreEntryDrawerBoundaryState> {
  state: ScoreEntryDrawerBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ScoreEntryDrawerBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ScoreEntryDrawer crash:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

export default ScoreEntryDrawerBoundary