import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent sandboxed iframe from throwing DOMException on alert or cross-origin script error
if (typeof window !== 'undefined') {
  window.alert = (msg?: any) => {
    console.warn('[Notice]:', msg);
  };

  (window as any).gm_authFailure = () => {
    console.warn('[Google Maps Auth Notice]: Running in sandboxed or preview environment.');
  };

  window.addEventListener('error', (event) => {
    if (event.message === 'Script error.' || event.message?.includes('Google Maps')) {
      // Prevent cross-origin script error from bubbling to uncaught error listeners
      event.preventDefault();
      console.warn('[Suppressed cross-origin script error]:', event);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
