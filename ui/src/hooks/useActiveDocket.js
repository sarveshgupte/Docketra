import { useContext } from 'react';
import { ActiveDocketContext } from '../contexts/ActiveDocketContext';

export const useActiveDocket = () => {
  const context = useContext(ActiveDocketContext);
  if (!context) {
    throw new Error('useActiveDocket must be used within ActiveDocketProvider');
  }
  return context;
};
