type IconProps = {
  name: string;
  className?: string;
};

const paths: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <path d="M4 5a1 1 0 0 1 1-1h5v7H4V5Z" />
      <path d="M14 4h5a1 1 0 0 1 1 1v3h-6V4Z" />
      <path d="M14 12h6v7a1 1 0 0 1-1 1h-5v-8Z" />
      <path d="M4 15h6v5H5a1 1 0 0 1-1-1v-4Z" />
    </>
  ),
  invoice: (
    <>
      <path d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2-2-1.33V5a2 2 0 0 1 2-2Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </>
  ),
  expenses: (
    <>
      <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      <path d="M9 13h6" />
    </>
  ),
  reports: (
    <>
      <path d="M5 20V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v15" />
      <path d="M8 17v-5" />
      <path d="M12 17V8" />
      <path d="M16 17v-3" />
    </>
  ),
  companies: (
    <>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M9 21v-7h6v7" />
      <path d="M8 9h.01" />
      <path d="M12 9h.01" />
      <path d="M16 9h.01" />
    </>
  ),
  settings: (
    <>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.05A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.04-.04a2 2 0 0 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.05a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.04-.04a2 2 0 0 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.15.61.8 1 1.55 1H21a2 2 0 0 1 0 4h-.05A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
  search: (
    <>
      <path d="m21 21-4.35-4.35" />
      <circle cx="11" cy="11" r="7" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
};

export function Icon({ name, className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}
