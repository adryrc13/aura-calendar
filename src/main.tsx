import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { registerServiceWorker } from './infrastructure/pwa/registerServiceWorker';
import { I18nProvider } from './shared/i18n';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
);

registerServiceWorker();
