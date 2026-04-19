import { useCallback, useEffect } from 'react';

const DEFAULT_MESSAGE = 'You have unsaved changes. Are you sure you want to leave without saving?';

export const useUnsavedChangesPrompt = ({ isDirty, isEnabled = true, message = DEFAULT_MESSAGE }) => {
  const shouldBlock = Boolean(isEnabled && isDirty);

  useEffect(() => {
    if (!shouldBlock) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [message, shouldBlock]);

  const confirmLeaveIfDirty = useCallback(() => {
    if (!shouldBlock) return true;
    return window.confirm(message);
  }, [message, shouldBlock]);

  return {
    shouldBlock,
    confirmLeaveIfDirty,
  };
};

export default useUnsavedChangesPrompt;
