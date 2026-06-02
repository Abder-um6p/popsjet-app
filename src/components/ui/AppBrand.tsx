import { cn } from '@/lib/utils'
import LogoJetPops from './LogoJetPops'

type BrandVariant = 'full' | 'compact' | 'icon-only'

interface AppBrandProps {
  variant?: BrandVariant
  className?: string
  logoSize?: number
}

export default function AppBrand({ variant = 'full', className, logoSize }: AppBrandProps) {
  const size = logoSize ?? (variant === 'compact' ? 28 : 32)

  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      <LogoJetPops size={size} />
      {variant !== 'icon-only' && (
        <div className={cn('flex flex-col leading-none', variant === 'compact' && 'hidden sm:flex')}>
          <span className="font-bold text-gray-900 tracking-tight text-[15px]">Jet Pops</span>
          <span className="text-[10px] text-gray-400 font-medium mt-0.5">I&amp;E Lab · UM6P</span>
        </div>
      )}
    </div>
  )
}
