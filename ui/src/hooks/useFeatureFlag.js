import { useMemo } from 'react';
import { FEATURE_FLAGS } from '../utils/featureFlags';
import { getFirmConfig } from '../utils/firmConfig';

const FLAG_TO_CONFIG_KEY = {
  BULK_ACTIONS: 'enableBulkActions',
  PERFORMANCE_VIEW: 'enablePerformanceView',
  ESCALATION_VIEW: 'enableEscalationView',
};

export const useFeatureFlag = (flagKey) =>
  useMemo(() => {
    const config = getFirmConfig();
    const mappedKey = FLAG_TO_CONFIG_KEY[flagKey];
    if (mappedKey && typeof config?.[mappedKey] === 'boolean') {
      return config[mappedKey];
    }
    const firmLevel = config?.featureFlags?.[flagKey];
    if (typeof firmLevel === 'boolean') return firmLevel;
    return FEATURE_FLAGS[flagKey] ?? false;
  }, [flagKey]);

