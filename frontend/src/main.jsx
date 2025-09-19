import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
// import CombinedDetection from './components/webcam'
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* <CombinedDetection /> */}
    <App />
     </StrictMode>,
)
