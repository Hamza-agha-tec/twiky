'use client'

import { Product } from '@/types/product'
import { ProductCard } from './ProductCard'

interface ProductGridProps {
  products: Product[]
  loading?: boolean
  onPay?: (product: Product) => void
  onViewDetails?: (product: Product) => void
}

function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-border bg-card">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
      <div className="h-32 w-full bg-muted/30" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-12 rounded-full bg-muted" />
        <div className="h-3 w-3/4 rounded-lg bg-muted" />
        <div className="h-2.5 w-full rounded-lg bg-muted/70" />
        <div className="mt-3 h-4 w-16 rounded-lg bg-muted" />
        <div className="flex gap-1.5">
          <div className="h-7 flex-1 rounded-lg bg-muted/60" />
          <div className="h-7 flex-1 rounded-lg bg-primary/20" />
        </div>
      </div>
    </div>
  )
}

export function ProductGrid({ products, loading = false, onPay, onViewDetails }: ProductGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (products.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, i) => (
        <ProductCard
          key={product.id}
          product={product}
          index={i}
          onPay={onPay}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  )
}
