import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

if (typeof process !== 'undefined' && process && typeof process.exit === 'function') {
  process.exit = (code) => {
    console.error('❌ Renderer attempted process.exit with code:', code);
  };
}

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
