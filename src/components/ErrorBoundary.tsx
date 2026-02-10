import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary, #0f0f14)',
        color: 'var(--text-primary, #e8e4e0)',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        padding: 24,
      }}>
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div style={{
            fontSize: 12,
            color: 'var(--error, #ef4444)',
            marginBottom: 8,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            FATAL ERROR
          </div>

          <div style={{
            padding: '16px 20px',
            backgroundColor: 'var(--bg-secondary, #1a1a24)',
            border: '1px solid var(--border-subtle, #23283c)',
            borderRadius: 4,
            marginBottom: 16,
          }}>
            <div style={{
              fontSize: 14,
              color: 'var(--text-secondary, #c4beb8)',
              marginBottom: 12,
            }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>

            {this.state.error?.stack && (
              <pre style={{
                fontSize: 11,
                color: 'var(--text-muted, #8f8880)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 160,
                overflow: 'auto',
                lineHeight: 1.5,
              }}>
                {this.state.error.stack.split('\n').slice(1, 6).join('\n')}
              </pre>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={this.handleReload}
              style={{
                flex: 1,
                padding: '10px 16px',
                backgroundColor: 'var(--accent, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
            >
              Reload
            </button>
            <button
              onClick={this.handleReset}
              style={{
                flex: 1,
                padding: '10px 16px',
                backgroundColor: 'var(--bg-tertiary, #313143)',
                color: 'var(--text-secondary, #c4beb8)',
                border: '1px solid var(--border-subtle, #23283c)',
                borderRadius: 4,
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }
}
