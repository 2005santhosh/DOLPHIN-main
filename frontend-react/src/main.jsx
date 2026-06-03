import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Log build version to console on every load.
// In production: open DevTools → Console and look for this line.
// Useful for support: "what version are you on?" → user pastes this line.
// Never exposes secrets — only the build timestamp and a random suffix.
const version = import.meta.env.VITE_APP_VERSION || 'dev';
console.log(`%c🐬 Dolphin v${version}`, 'color:#84CC16;font-weight:bold;font-size:12px');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
