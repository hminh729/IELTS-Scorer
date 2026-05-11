import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GradingProvider } from './context/GradingContext'
import './index.css'
import App from './App.tsx'

// Lấy Client ID từ biến môi trường (hoặc fix cứng nếu cần)
const GOOGLE_CLIENT_ID = "628992838803-joa33jjems3ts55i3n640pq2d79jsd3j.apps.googleusercontent.com";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <AuthProvider>
          <GradingProvider>
            <App />
          </GradingProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
)
