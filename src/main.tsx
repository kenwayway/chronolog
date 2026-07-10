import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider } from './components/providers/ThemeProvider'
import { ToastProvider } from './components/providers/ToastProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/common/Toast'
import './styles/index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ErrorBoundary>
            <ThemeProvider>
                <ToastProvider>
                    <HashRouter>
                        <App />
                    </HashRouter>
                    <ToastContainer />
                </ToastProvider>
            </ThemeProvider>
        </ErrorBoundary>
    </StrictMode>,
)
