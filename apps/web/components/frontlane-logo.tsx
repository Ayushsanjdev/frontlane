import {useId} from 'react';

export function FrontlaneLogo({className = 'h-9 w-auto'}: {className?: string}) {
  const id = useId();
  const blue = `${id}-laneBlue`;
  const orange = `${id}-laneOrange`;

  return (
    <span className="frontlane-logo inline-flex items-center gap-2.5 select-none">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={blue} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id={orange} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>
        </defs>
        <path d="M10 40V16C10 11.5817 13.5817 8 18 8H34L30 4L35 4L41 10L35 16H30L34 12H18C15.7909 12 14 13.7909 14 16V40H10Z" fill={`url(#${blue})`} />
        <path d="M18 40V25C18 21.6863 20.6863 19 24 19H33L30 16H34.5L39.5 21L34.5 26H30L33 23H24C22.8954 23 22 23.8954 22 25V40H18Z" fill={`url(#${orange})`} />
        <rect x="26" y="30" width="4" height="10" rx="2" fill="#06B6D4" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="frontlane-wordmark text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">FRONTLANE</span>
        <span className="text-[10px] font-bold tracking-[0.28em] text-orange-500 uppercase">JOBS</span>
      </span>
    </span>
  );
}
