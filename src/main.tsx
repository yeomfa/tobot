import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/*
  Bundled rather than linked from Google's CDN. A campus network that blocks
  or throttles an external font host would otherwise leave every student
  reading a different fallback, which is the situation this replaces: the
  tokens named Inter and JetBrains Mono while the app shipped no fonts at all.
  Variable fonts, so every weight the interface uses costs one file.
*/
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';

import App from './App';
import './styles/base.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
