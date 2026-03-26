export const normalizeApiResponse = (rawResponse) => {
  const payload = rawResponse?.data;

  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'success')) {
    return {
      success: Boolean(payload.success),
      data: payload.data ?? null,
      message: payload.message || '',
      meta: payload.meta,
    };
  }

  return {
    success: true,
    data: payload ?? null,
    message: '',
  };
};

export const extractErrorMessage = (error, fallbackMessage) => {
  const serverMessage = error?.response?.data?.message;
  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage.slice(0, 240);
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.slice(0, 240);
  }
  return fallbackMessage;
};
