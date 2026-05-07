import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './theme-v2.css'
import App from './App'
import MobileAwareToaster from './components/MobileAwareToaster'

// Visual Refactor: ?theme=v1 falls back to legacy palette. v2 is default.
{
  const url = new URLSearchParams(location.search).get('theme')
  if (url === 'v1' || url === 'v2') localStorage.setItem('se.theme', url)
  const theme = url ?? localStorage.getItem('se.theme') ?? 'v2'
  document.documentElement.dataset.theme = theme
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <MobileAwareToaster />
    </BrowserRouter>
  </StrictMode>,
)
