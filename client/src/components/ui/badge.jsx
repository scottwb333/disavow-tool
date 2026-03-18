import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const variants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground border-border',
        destructive: 'border-transparent bg-destructive/15 text-destructive',
        success: 'border-transparent bg-emerald-500/15 text-emerald-400'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

export function Badge({ className, variant, ...props }) {
  return <div className={cn(variants({ variant }), className)} {...props} />
}
