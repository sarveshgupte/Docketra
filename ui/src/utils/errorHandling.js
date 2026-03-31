export const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export const getErrorMessage = (error, fallback = DEFAULT_ERROR_MESSAGE) => {
  if (!error) return fallback;

  const candidates = [
    error?.data?.message,
    error?.data?.error,
    error?.response?.data?.message,
    error?.response?.data?.error,
    error?.message,
  ];

  const message = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return message || fallback;
};

export const toUserFacingError = (error, fallback = DEFAULT_ERROR_MESSAGE) => {
  const status = error?.status || error?.response?.status;
  const message = getErrorMessage(error, fallback);

  if (status >= 500) {
    return 'Server is unavailable right now. Please retry in a moment.';
  }

  return message;
};
