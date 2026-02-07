/**
 * Firm Switcher Component
 * Allows SuperAdmin to select and switch into a firm context
 */

import React, { useState, useEffect } from 'react';
import { superadminService } from '../../services/superadminService';
import { useToast } from '../../hooks/useToast';
import { Button } from './Button';
import './FirmSwitcher.css';

export const FirmSwitcher = ({ onFirmSwitch }) => {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadFirms();
  }, []);

  const loadFirms = async () => {
    try {
      setLoading(true);
      const response = await superadminService.listFirms();
      if (response.success) {
        // Only show active firms
        const activeFirms = (response.data || []).filter(f => f.status === 'ACTIVE');
        setFirms(activeFirms);
      }
    } catch (error) {
      console.error('Error loading firms:', error);
      toast.error('Failed to load firms');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchFirm = async (firmId) => {
    try {
      setLoading(true);
      const response = await superadminService.switchFirm(firmId);
      if (response.success) {
        toast.success(response.message);
        setShowDropdown(false);
        if (onFirmSwitch) {
          onFirmSwitch(response.data);
        }
      }
    } catch (error) {
      console.error('Error switching firm:', error);
      toast.error(error.response?.data?.message || 'Failed to switch firm context');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="firm-switcher">
      <Button
        variant="primary"
        size="small"
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Switch to Firm'}
      </Button>
      
      {showDropdown && (
        <>
          <div 
            className="firm-switcher__backdrop" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="firm-switcher__dropdown">
            <div className="firm-switcher__header">
              <h3>Select a Firm</h3>
              <button 
                className="firm-switcher__close"
                onClick={() => setShowDropdown(false)}
              >
                ×
              </button>
            </div>
            <div className="firm-switcher__list">
              {firms.length === 0 ? (
                <div className="firm-switcher__empty">No active firms available</div>
              ) : (
                firms.map((firm) => (
                  <button
                    key={firm._id}
                    className="firm-switcher__item"
                    onClick={() => handleSwitchFirm(firm._id)}
                    disabled={loading}
                  >
                    <div className="firm-switcher__item-name">{firm.name}</div>
                    <div className="firm-switcher__item-meta">
                      {firm.firmId} • {firm.firmSlug}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
