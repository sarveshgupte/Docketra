import React, { useEffect, useState } from 'react';

export const SuperadminLiveClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="text-right">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{dateStr}</p>
      <p className="text-base font-mono font-bold tracking-wider text-slate-800">{timeStr}</p>
    </div>
  );
};
