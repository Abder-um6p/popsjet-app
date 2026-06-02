import { type LucideProps } from 'lucide-react'

export function PopcornIcon({ size = 24, className, strokeWidth = 2, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Puffs */}
      <circle cx="7" cy="9" r="2.5" />
      <circle cx="12" cy="7" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      {/* Bucket top rim */}
      <line x1="5" y1="13" x2="19" y2="13" />
      {/* Bucket body */}
      <path d="M5 13l1.5 9h11l1.5-9" />
      {/* Stripes */}
      <line x1="10" y1="13" x2="9.5" y2="22" />
      <line x1="14" y1="13" x2="14.5" y2="22" />
    </svg>
  )
}
