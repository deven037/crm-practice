import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { getValue } from './data/store';
import { apiFetch } from './data/apiFetch';
import './styles.css';

async function boot() {
  // ?reset=true wipes the server's data and reseeds — for repeatable automated test runs.
  // This endpoint needs no auth, so it can run before any login.
  const params = new URLSearchParams(window.location.search);
  if (params.get('reset') === 'true') {
    await apiFetch('/reset', { method: 'POST' });
    params.delete('reset');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }

  // Pure client/device preference — stays on localStorage, read before render to avoid a
  // flash of the wrong theme. (The CRM-data cache itself is warmed later, once
  // AuthContext confirms a valid session — see initStore() in AuthContext.tsx.)
  document.documentElement.dataset.theme = getValue('theme', 'light');

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

boot();
