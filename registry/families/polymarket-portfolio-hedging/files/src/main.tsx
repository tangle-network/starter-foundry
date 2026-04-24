import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('missing #root — index.html must contain <div id="root">')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
