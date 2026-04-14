import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('CineRank error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-dvh bg-base p-8 text-center">
          <div className="text-5xl mb-4">🎬</div>
          <h2 className="text-lg font-bold text-ink-primary mb-2">Something went wrong</h2>
          <p className="text-sm text-ink-secondary mb-6 max-w-xs">
            The app hit an unexpected error. Your votes are saved — just reload to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gold text-black font-bold rounded-xl text-sm"
          >
            Reload App
          </button>
          {import.meta.env.DEV && (
            <pre className="mt-6 text-left text-[10px] text-lose bg-raised p-4 rounded-xl max-w-sm overflow-auto">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
