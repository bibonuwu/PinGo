import React from 'react';
import ReactDOM from 'react-dom/client';
import './lib/install';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/layout.css';
import './styles/auth.css';
import './styles/pages.css';
import './styles/room.css';
import App from './App';
import { startSync } from './services/sync';

// Следим за входом в Firebase и держим локальное зеркало данных пользователя в актуальном состоянии.
startSync();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
