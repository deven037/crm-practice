import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ensureSeeded, resetData, getValue } from './data/store';
import './styles.css';

// ?reset=true wipes everything and reseeds — for repeatable automated test runs.
const params = new URLSearchParams(window.location.search);
if (params.get('reset') === 'true') {
  resetData();
  params.delete('reset');
  const qs = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
} else {
  ensureSeeded();
}

document.documentElement.dataset.theme = getValue('theme', 'light');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
