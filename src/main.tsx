import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      if (
        event.message &&
        (event.message.includes('ResizeObserver loop') ||
          event.message.includes('ResizeObserver loop completed'))
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(<App />);

