import api from '../services/api';

export const handleApiSuccess = (response) => ({
  success: Boolean(response?.data?.success ?? true),
  ...response?.data,
});

export const handleApiError = (error, fallbackMessage = 'Request failed') => {
  const serverMessage = error?.response?.data?.message;
  const serverError = error?.response?.data?.error;
  const resolvedMessage = typeof serverMessage === 'string' && serverMessage.trim()
    ? serverMessage
    : typeof serverError === 'string' && serverError.trim()
      ? serverError
      : typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : fallbackMessage;

  const normalizedError = new Error(
    resolvedMessage
  );

  normalizedError.status = error?.response?.status;
  normalizedError.code = error?.response?.data?.code;
  normalizedError.data = error?.response?.data;
  normalizedError.originalError = error;

  throw normalizedError;
};

export const request = async (requestFn, fallbackMessage) => {
  try {
    const response = await requestFn(api);
    return handleApiSuccess(response);
  } catch (error) {
    if (error?.response?.status === 304) {
      return {
        ...handleApiSuccess(error.response),
        notModified: true,
      };
    }
    return handleApiError(error, fallbackMessage);
  }
};
