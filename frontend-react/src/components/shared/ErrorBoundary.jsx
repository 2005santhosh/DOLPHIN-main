import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          background: '#FEE2E2',
          borderRadius: '0.5rem',
          margin: '2rem',
        }}>
          <h2 style={{ color: '#DC2626', marginBottom: '1rem' }}>
            ⚠️ Something went wrong
          </h2>
          <p style={{ color: '#991B1B', marginBottom: '1rem' }}>
            {this.state.error && this.state.error.toString()}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#DC2626',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            Reload Page
          </button>
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{ marginTop: '2rem', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
                Error Details
              </summary>
              <pre style={{
                background: 'white',
                padding: '1rem',
                borderRadius: '0.5rem',
                overflow: 'auto',
                fontSize: '0.75rem',
                marginTop: '0.5rem',
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
