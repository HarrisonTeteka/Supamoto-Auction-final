import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class RootErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('ROOT CRASH:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #336021 0%, #1a3a10 50%, #9E2A2B 100%)',
          fontFamily: 'Poppins, sans-serif', padding: '24px'
        }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</p>
            <p style={{ color: '#b91c1c', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '8px' }}>App Error</p>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '24px', wordBreak: 'break-word' }}>
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              style={{ background: '#336021', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 32px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
