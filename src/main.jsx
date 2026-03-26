import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Unregister any stale service workers (from old HTML demo at this origin)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  })
}

createRoot(document.getElementById('root')).render(<App />)
