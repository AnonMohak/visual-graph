import * as React from 'react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crashed:', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex h-svh w-full flex-col items-center justify-center gap-3 bg-background p-6 text-center text-foreground">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm break-words text-muted-foreground">
            {this.state.error.message || 'The graph UI crashed. Your equations are saved locally.'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={this.handleReset}>
              Try again
            </Button>
            <Button size="sm" onClick={this.handleReload}>
              Reload
            </Button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
