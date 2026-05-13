'use client'

import { Product, ProductCategory } from '@/types/product'
import { motion } from 'framer-motion'
import { ShoppingCart, Eye, Flame, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  product: Product
  onPay?: (product: Product) => void
  onViewDetails?: (product: Product) => void
  index?: number
}

const CATEGORY_META: Record<ProductCategory, { label: string; emoji: string; bg: string }> = {
  THEME:     { label: 'Theme',     emoji: '🎨', bg: 'from-primary/20 via-primary/5 to-transparent' },
  STICKER:   { label: 'Sticker',   emoji: '✨', bg: 'from-[var(--twiky-cyan)]/20 via-[var(--twiky-cyan)]/5 to-transparent' },
  ROOM_ITEM: { label: 'Room Item', emoji: '🏠', bg: 'from-amber-500/20 via-amber-500/5 to-transparent' },
}

export function ProductCard({ product, onPay, onViewDetails, index = 0 }: ProductCardProps) {
  const meta = CATEGORY_META[product.category]
  const hasImage = Array.isArray(product.images) && product.images.length > 0
  const img = hasImage ? product.images[0] : null
  const hasDiscount = Boolean(product.discount && product.discount > 0)
  const discountedPrice = hasDiscount
    ? product.price * (1 - product.discount! / 100)
    : product.price

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.035, 0.28), ease: 'easeOut' }}
      className="group relative flex flex-col overflow-hidden rounded-[16px] border border-border bg-card transition-all duration-200 hover:border-primary/25 hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className={cn('relative h-32 w-full overflow-hidden bg-gradient-to-br', meta.bg)}>
        {img
          ? <img src={img} alt={product.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : <div className="flex h-full w-full items-center justify-center text-3xl">{meta.emoji}</div>
        }

        {/* Hover actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-background/0 opacity-0 transition-all duration-200 group-hover:bg-background/50 group-hover:opacity-100">
          <button
            onClick={() => onViewDetails?.(product)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={() => onPay?.(product)}
            disabled={!product.active}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-opacity disabled:opacity-40 hover:opacity-90"
          >
            <ShoppingCart className="h-3 w-3" />
          </button>
        </div>

        {/* Badges */}
        {hasDiscount && (
          <span className="absolute left-2 top-2 flex items-center gap-0.5 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
            <Flame className="h-2 w-2" />
            -{product.discount}%
          </span>
        )}
        {product.sales > 10 && !hasDiscount && (
          <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md border border-border bg-card/80 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground backdrop-blur-sm">
            <Star className="h-2 w-2 fill-current" />
            Popular
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        {/* Category chip */}
        <span className="mb-1.5 inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-primary">
          {meta.label}
        </span>

        <h3 className="line-clamp-1 text-[12px] font-bold text-foreground leading-tight">
          {product.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-[10.5px] leading-snug text-muted-foreground">
          {product.description}
        </p>

        {/* Price + Actions */}
        <div className="mt-auto pt-3">
          <div className="mb-2 flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold text-primary leading-none">
              ${discountedPrice.toFixed(2)}
            </span>
            {hasDiscount && (
              <span className="text-[10px] text-muted-foreground line-through">
                ${product.price.toFixed(2)}
              </span>
            )}
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => onViewDetails?.(product)}
              className="flex h-7 flex-1 items-center justify-center rounded-lg border border-border bg-background text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Details
            </button>
            <button
              onClick={() => onPay?.(product)}
              disabled={!product.active}
              className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg bg-primary text-[10px] font-bold text-primary-foreground transition-opacity disabled:opacity-40 hover:opacity-90"
            >
              <ShoppingCart className="h-3 w-3" />
              Buy
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
