import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import MobileAwareToaster from './components/MobileAwareToaster'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <MobileAwareToaster />
    </BrowserRouter>
  </StrictMode>,
)
