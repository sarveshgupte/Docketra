import { FEATURE_FLAGS } from './featureFlags';

const FIRM_CONFIG_STORAGE_KEY = 'firmConfig';

const DEFAULT_FIRM_CONFIG = {
  slaDefaultDays: 3,
  escalationInactivityThresholdHours: 24,
  workloadThreshold: 15,
  enablePerformanceView: true,
  enableEscalationView: true,
  enableBulkActions: true,
  brandLogoUrl: '',
  featureFlags: { ...FEATURE_FLAGS },
};

export const getFirmConfig = () => {
  try {
    const raw = localStorage.getItem(FIRM_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FIRM_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_FIRM_CONFIG,
      ...parsed,
      featureFlags: {
        ...FEATURE_FLAGS,
        ...(parsed?.featureFlags || {}),
      },
    };
  } catch {
    return { ...DEFAULT_FIRM_CONFIG };
  }
};

export const setFirmConfig = (nextConfig = {}) => {
  const merged = {
    ...getFirmConfig(),
    ...nextConfig,
    featureFlags: {
      ...FEATURE_FLAGS,
      ...(getFirmConfig().featureFlags || {}),
      ...(nextConfig.featureFlags || {}),
    },
  };
  localStorage.setItem(FIRM_CONFIG_STORAGE_KEY, JSON.stringify(merged));
  return merged;
};
