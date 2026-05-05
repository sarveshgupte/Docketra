import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { validateXID } from '../utils/validators';
import { authApi } from '../api/auth.api';

export const FindWorkspacePage = () => {
  const [xid, setXid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [choices, setChoices] = useState([]);
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setChoices([]);
    const normalizedXid = xid.trim().toUpperCase();
    if (!validateXID(normalizedXid)) { setError('Enter a valid xID (example: X123456).'); return; }
    setLoading(true);
    try {
      const res = await authApi.findWorkspacesByXid(normalizedXid);
      const matches = Array.isArray(res?.data?.workspaces) ? res.data.workspaces : [];
      if (matches.length === 1) navigate(`/${matches[0].firmSlug}/login`);
      else if (matches.length > 1) setChoices(matches);
      else setError('If your workspace is active, ask your administrator for the exact workspace login URL.');
    } catch (_e) {
      setError('If your workspace is active, ask your administrator for the exact workspace login URL.');
    } finally { setLoading(false); }
  };

  return <div className="auth-wrapper"><Card className="auth-card max-w-form"><h1 className="text-2xl font-semibold text-center">Find my workspace</h1><p className="mt-3 text-sm text-gray-500 text-center">Enter your xID to continue to your workspace login.</p><form onSubmit={onSubmit} className="mt-4"><Input label="xID" value={xid} onChange={(e)=>setXid(e.target.value.toUpperCase())} placeholder="X123456" required /><Button type="submit" fullWidth loading={loading} disabled={loading}>Find workspace</Button></form>{error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}{choices.length>1 ? <div className="mt-4"><p className="text-sm text-gray-600 mb-2">Select your workspace:</p>{choices.map((item)=><button key={item.firmSlug} type="button" onClick={()=>navigate(`/${item.firmSlug}/login`)} className="block w-full text-left rounded border p-2 mb-2 hover:bg-gray-50"><span className="font-medium">{item.firmName}</span><span className="text-xs text-gray-500 ml-2">/{item.firmSlug}</span></button>)}</div>:null}</Card></div>;
};
