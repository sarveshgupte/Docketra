import api from '../services/api';

export const handleApiSuccess = (response) => ({
  success: Boolean(response?.data?.success ?? true),
  ...response?.data,
});

export const handleApiError = (error, fallbackMessage = 'Request failed') => {
  const normalizedError = new Error(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallbackMessage
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
    return handleApiError(error, fallbackMessage);
  }
};
