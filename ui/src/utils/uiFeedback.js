import { toUserFacingError } from './errorHandling';

export const resolveUiError = (error, options = {}) => {
  const {
    fallbackMessage = 'Something went wrong. Please try again.',
    toast,
    inline = true,
    toastMessage,
    toastOnError = false,
  } = options;

  const message = toUserFacingError(error, fallbackMessage);
  const alreadyToasted = Boolean(error?.uiFeedback?.toasted);
  const shouldToast = Boolean(toast && toastOnError && !alreadyToasted);

  if (shouldToast) {
    toast.error(toastMessage || message);
  }

  return {
    message,
    inlineMessage: inline && !shouldToast && !alreadyToasted ? message : '',
    toasted: shouldToast || alreadyToasted,
  };
};

