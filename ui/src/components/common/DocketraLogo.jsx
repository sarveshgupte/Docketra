import React from 'react';

/**
 * DocketraLogo Component
 * Reusable brand mark + logotype for authentication and marketing pages.
 */
export const DocketraLogo = ({ size = 'md', className = '' }) => {
  const isSm = size === 'sm';
  return (
    <div className={`inline-flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-slate-950 ${className}`}>
      <svg
        className={`${isSm ? 'h-8 w-8' : 'h-9 w-9'} text-amber-600 shrink-0`}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex flex-col leading-none text-left">
        <span className={`${isSm ? 'text-base' : 'text-lg'} font-black text-slate-900 tracking-tight`}>
          Docketra
        </span>
        <span className={`${isSm ? 'text-[7px]' : 'text-[8px]'} font-bold text-amber-700 tracking-wider uppercase mt-0.5`}>
          The Company Brain
        </span>
      </div>
    </div>
  );
};

export default DocketraLogo;
