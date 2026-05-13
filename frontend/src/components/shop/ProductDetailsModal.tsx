'use client'

import { Product, ProductCategory } from '@/types/product'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, ShoppingCart, Flame, Star, Check, X, TrendingUp, Calendar, Tag } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProductDetailsModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onPay?: (product: Product) => void
  isProcessingPayment?: boolean
}

const CATEGORY_META: Record<ProductCategory, { label: string; emoji: string; bg: string }> = {
  THEME:     { label: 'Theme',     emoji: '🎨', bg: 'from-primary/25 via-primary/10 to-transparent' },
  STICKER:   { label: 'Sticker',   emoji: '✨', bg: 'from-[var(--twiky-cyan)]/25 via-[var(--twiky-cyan)]/8 to-transparent' },
  ROOM_ITEM: { label: 'Room Item', emoji: '🏠', bg: 'from-amber-500/25 via-amber-500/8 to-transparent' },
}

export function ProductDetailsModal({ product, isOpen, onClose, onPay, isProcessingPayment = false }: ProductDetailsModalProps) {
  const [activeImg, setActiveImg] = useState(0)

  if (!product) return null

  const meta       = CATEGORY_META[product.category]
  const images     = Array.isArray(product.images) && product.images.length > 0 ? product.images as string[] : []
  const mainImage  = images[activeImg] ?? null
  const hasDiscount = Boolean(product.discount && product.discount > 0)
  const finalPrice = hasDiscount ? product.price * (1 - product.discount! / 100) : product.price
  const savings    = hasDiscount ? product.price - finalPrice : 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-[20px] border-border bg-card p-0 shadow-2xl"
        style={{ width: 'min(calc(100vw - 2rem), 46rem)', maxWidth: 'none' }}
      >
        <div className="flex flex-col md:flex-row min-h-0">

          {/* ── Image panel ───────────────────────────────────── */}
          <div className="relative w-full md:w-[42%] shrink-0">
            <div className={cn('relative flex h-48 md:h-full min-h-[200px] items-center justify-center overflow-hidden bg-gradient-to-br', meta.bg)}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeImg}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {mainImage
                    ? <img src={mainImage} alt={product.title} className="h-full w-full object-cover" />
                    : <span className="text-6xl select-none">{meta.emoji}</span>
                  }
                </motion.div>
              </AnimatePresence>

              {hasDiscount && (
                <span className="absolute left-3 top-3 flex items-center gap-0.5 rounded-lg bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  <Flame className="h-2.5 w-2.5" />
                  -{product.discount}%
                </span>
              )}
              {product.sales > 10 && (
                <span className="absolute right-3 top-3 flex items-center gap-0.5 rounded-lg border border-border bg-card/80 px-2 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur-sm">
                  <Star className="h-2.5 w-2.5 fill-current text-amber-400" />
                  Popular
                </span>
              )}
            </div>

            {images.length > 1 && (
              <div className="absolute bottom-2 left-2 flex gap-1.5">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={cn(
                      'h-9 w-9 overflow-hidden rounded-lg border-2 transition-all duration-150',
                      i === activeImg ? 'border-primary' : 'border-border opacity-50 hover:opacity-80',
                    )}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Details panel ─────────────────────────────────── */}
          <div className="flex flex-1 flex-col overflow-y-auto p-5">

            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary">
              <Tag className="h-2 w-2" />
              {meta.label}
            </span>

            <h2 className="text-[17px] font-bold leading-tight tracking-tight text-foreground">
              {product.title}
            </h2>

            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {product.description}
            </p>

            {product.features?.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">Includes</p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {product.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-foreground/80">
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Check className="h-2 w-2" />
                      </span>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatBox icon={<TrendingUp className="h-3 w-3" />} label="Sales" value={String(product.sales)} />
              <StatBox
                icon={<Calendar className="h-3 w-3" />}
                label="Added"
                value={new Date(product.created_at).toLocaleDateString('en', { month: 'short', year: '2-digit' })}
              />
              {hasDiscount
                ? <StatBox icon={<Flame className="h-3 w-3" />} label="You save" value={`$${savings.toFixed(2)}`} highlight />
                : <StatBox icon={<Star className="h-3 w-3" />} label="Status" value={product.active ? 'Available' : 'N/A'} />
              }
            </div>

            <div className="my-4 h-px bg-border" />

            <div className="mt-auto">
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-[26px] font-black leading-none tracking-tight text-primary">
                  ${finalPrice.toFixed(2)}
                </span>
                {hasDiscount && (
                  <span className="text-[14px] text-muted-foreground line-through">
                    ${product.price.toFixed(2)}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-9 flex-1 rounded-[10px] text-[12px] font-bold"
                  disabled={!product.active || isProcessingPayment}
                  onClick={() => onPay?.(product)}
                >
                  {isProcessingPayment
                    ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Processing…</>
                    : <><ShoppingCart className="mr-1.5 h-3.5 w-3.5" />Buy · ${finalPrice.toFixed(2)}</>
                  }
                </Button>
                <Button variant="outline" size="sm" className="h-9 rounded-[10px] px-4 text-[12px]" onClick={onClose} disabled={isProcessingPayment}>
                  Cancel
                </Button>
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatBox({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn(
      'flex flex-col gap-0.5 rounded-[10px] border p-2.5',
      highlight ? 'border-primary/25 bg-primary/10' : 'border-border bg-background',
    )}>
      <span className={cn('flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide', highlight ? 'text-primary/70' : 'text-muted-foreground')}>
        {icon}{label}
      </span>
      <span className={cn('text-[13px] font-bold', highlight ? 'text-primary' : 'text-foreground')}>
        {value}
      </span>
    </div>
  )
}
