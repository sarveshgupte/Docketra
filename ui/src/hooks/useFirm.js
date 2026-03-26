import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './useAuth';
import { ROUTES, hasValidFirmSlug } from '../constants/routes';
import { STORAGE_KEYS } from '../utils/constants';

export const useFirm = ({ redirectOnMissing = false } = {}) => {
  const { firmSlug: routeFirmSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const firmSlug = useMemo(
    () => routeFirmSlug || user?.firmSlug || localStorage.getItem(STORAGE_KEYS.FIRM_SLUG) || null,
    [routeFirmSlug, user?.firmSlug]
  );

  const isValidFirm = hasValidFirmSlug(firmSlug);

  const guardFirm = () => {
    if (!isValidFirm) {
      if (redirectOnMissing) {
        navigate(ROUTES.SUPERADMIN_LOGIN, { replace: true });
      }
      return false;
    }
    return true;
  };

  return { firmSlug, isValidFirm, guardFirm };
};
