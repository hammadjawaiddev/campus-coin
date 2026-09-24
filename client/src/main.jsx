import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './index.css';

/** Dismiss the inline boot splash after the first React paint. */
function BootDismiss() {
  useEffect(() => {
    const boot = document.getElementById('boot');
    if (!boot) return undefined;
    boot.style.transition = 'opacity .35s ease';
    boot.style.opacity = '0';
    const timer = setTimeout(() => boot.remove(), 380);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Auth must wrap Theme — ThemeProvider calls useAuth(). */}
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <BootDismiss />
            <App />
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
