import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (!(window as any).__LOOTIFY_APP_MOUNTED__) {
  (window as any).__LOOTIFY_APP_MOUNTED__ = true;
  const rootEl = document.getElementById('root');
  if (rootEl) {
    createRoot(rootEl).render(<App />);
  }
}

