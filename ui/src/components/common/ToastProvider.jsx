/**
 * ToastProvider
 * Thin re-export of the ToastContext provider for convenient import.
 * The full implementation lives in contexts/ToastContext.jsx.
 *
 * Usage (already wired in App.jsx):
 *   import { ToastProvider } from './components/common/ToastProvider';
 *   <ToastProvider>...</ToastProvider>
 *
 * Consuming toast:
 *   import { useToast } from '../../hooks/useToast';
 *   const { showToast } = useToast();
 *   showToast('7 cases assigned to you', { type: 'success' });
 */

export { ToastProvider } from '../../contexts/ToastContext';
