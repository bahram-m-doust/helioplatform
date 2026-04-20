import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './i18n'
import './styles/globals.css'

// Keep BrowserRouter's basename in sync with Vite's `base` so the same build
// works both at '/' (dev) and '/heliogram' (prod behind the edge nginx).
// import.meta.env.BASE_URL is injected by Vite and always ends with '/'.
const rawBase = (import.meta.env.BASE_URL as string | undefined) ?? '/'
const basename = rawBase === '/' ? '/' : rawBase.replace(/\/+$/, '')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* BrowserRouter keeps route state client-side for SPA behavior. */}
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
