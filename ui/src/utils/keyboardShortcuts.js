export const isEditableTarget = (target) => {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  if (target.isContentEditable) return true;
  return tag === 'input' || tag === 'textarea' || tag === 'select';
};

export const isShortcutAllowedTarget = (target) => !isEditableTarget(target);
