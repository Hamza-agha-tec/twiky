'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Product, ProductCategory } from '@/types/product'
import { productsAPI } from '@/lib/api/products'
import { paymentsAPI } from '@/lib/api/payments'
import { ProductDetailsModal } from '@/components/shop/ProductDetailsModal'
import { toast, Toaster } from 'sonner'
import { Search, X, Flame, SlidersHorizontal, Sparkles, ChevronDown, Check, Package, Palette, Tag, Layers, ShoppingBag, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProductGrid } from '@/components/shop/ProductGrid'
import { Button } from '@/components/ui/button'

type CategoryId = 'all' | ProductCategory

const CATEGORIES = [
  { id: 'all' as CategoryId,                   label: 'All',        icon: Layers  },
  { id: ProductCategory.THEME as CategoryId,    label: 'Themes',     icon: Palette },
  { id: ProductCategory.STICKER as CategoryId,  label: 'Stickers',   icon: Tag     },
  { id: ProductCategory.ROOM_ITEM as CategoryId,label: 'Room Items', icon: Package },
]

const SORTS = [
  { id: 'newest',     label: 'Newest',         sortBy: 'created_at' as keyof Product, sortOrder: 'desc' as const },
  { id: 'popular',   label: 'Most Popular',    sortBy: 'sales'      as keyof Product, sortOrder: 'desc' as const },
  { id: 'price-asc', label: 'Price: Low → High',sortBy: 'price'     as keyof Product, sortOrder: 'asc'  as const },
  { id: 'price-desc',label: 'Price: High → Low',sortBy: 'price'     as keyof Product, sortOrder: 'desc' as const },
]

export default function ShopPage() {
  const [allProducts, setAllProducts]       = useState<Product[]>([])
  const [featuredProducts, setFeatured]     = useState<Product[]>([])
  const [loading, setLoading]               = useState(true)
  const [selectedProduct, setSelected]      = useState<Product | null>(null)
  const [isModalOpen, setModalOpen]         = useState(false)
  const [isPaying, setIsPaying]             = useState(false)
  const [activeCategory, setCategory]       = useState<CategoryId>('all')
  const [search, setSearch]                 = useState('')
  const [sortId, setSortId]                 = useState('newest')
  const [onSale, setOnSale]                 = useState(false)
  const [sortOpen, setSortOpen]             = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [all, feat] = await Promise.all([
        productsAPI.getActiveProducts(),
        productsAPI.getFeaturedProducts(3),
      ])
      setAllProducts(all)
      setFeatured(feat)
    } catch { toast.error('Failed to load products') }
    finally { setLoading(false) }
  }

  const activeSort = SORTS.find(s => s.id === sortId) ?? SORTS[0]

  const filtered = useMemo(() => {
    let r = [...allProducts]
    if (activeCategory !== 'all') r = r.filter(p => p.category === activeCategory)
    if (onSale) r = r.filter(p => p.discount && p.discount > 0)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      r = r.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    r.sort((a, b) => {
      let av: any = a[activeSort.sortBy], bv: any = b[activeSort.sortBy]
      if (activeSort.sortBy === 'created_at') { av = new Date(av); bv = new Date(bv) }
      return activeSort.sortOrder === 'desc' ? (av > bv ? -1 : 1) : (av < bv ? -1 : 1)
    })
    return r
  }, [allProducts, activeCategory, onSale, search, activeSort])

  const onSaleCount = allProducts.filter(p => p.discount && p.discount > 0).length

  async function handlePay(product: Product) {
    if (isPaying) return
    setIsPaying(true)
    try {
      const res = await paymentsAPI.createProductCheckout({
        product_id: product.id,
        currency: 'USD',
        redirect_url: `${window.location.origin}/shop?payment=success`,
        cancel_url:   `${window.location.origin}/shop?payment=cancelled`,
      })
      toast.success('Redirecting to checkout…')
      setTimeout(() => { window.location.href = res.checkout_url }, 900)
    } catch { toast.error('Payment failed. Try again.') }
    finally { setIsPaying(false) }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-5 py-7">

        {/* ── Header ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                Twiky Shop
              </div>
              <h1 className="text-[20px] font-bold tracking-tight text-foreground">Upgrade your experience</h1>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Premium themes, stickers, and room items.</p>
            </div>
            <div className="flex items-center gap-2">
              <StatChip icon={<ShoppingBag className="h-2.5 w-2.5" />} value={allProducts.length} label="items" />
              <StatChip icon={<Flame className="h-2.5 w-2.5" />} value={onSaleCount} label="sale" />
            </div>
          </div>
        </motion.div>

        {/* ── Featured ─────────────────────────────────────────── */}
        <AnimatePresence>
          {!loading && featuredProducts.length > 0 && activeCategory === 'all' && !search && !onSale && (
            <motion.div
              key="featured"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.22 }}
              className="mb-5"
            >
              <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                <Sparkles className="h-2.5 w-2.5" />
                Featured
              </p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {featuredProducts.map((p, i) => (
                  <FeaturedCard key={p.id} product={p} index={i} onClick={() => { setSelected(p); setModalOpen(true) }} />
                ))}
              </div>
              <div className="mt-5 h-px bg-border" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Controls ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.08 }}
          className="mb-4 flex flex-wrap items-center justify-between gap-2"
        >
          {/* Category tabs */}
          <div className="flex items-center gap-1">
            {CATEGORIES.map(cat => {
              const active = activeCategory === cat.id
              const Icon = cat.icon
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 border',
                    active
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent border-transparent',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {cat.label}
                  {active && (
                    <span className="rounded-full bg-primary/15 px-1 py-px text-[9px] font-bold text-primary">
                      {cat.id === 'all' ? allProducts.length : allProducts.filter(p => p.category === cat.id).length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Right: search + sale + sort */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setOnSale(v => !v)}
              className={cn(
                'flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[10px] font-semibold transition-all',
                onSale ? 'border-primary/25 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              <Flame className="h-3 w-3" />
              Sale
            </button>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-7 w-[120px] rounded-lg border border-border bg-card pl-6.5 pr-6 text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>

            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setSortOpen(v => !v)}
                className="flex h-7 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <SlidersHorizontal className="h-3 w-3" />
                {activeSort.label}
                <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', sortOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[160px] overflow-hidden rounded-[10px] border border-border bg-card shadow-lg"
                  >
                    {SORTS.map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSortId(s.id); setSortOpen(false) }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-[11px] transition-colors',
                          s.id === sortId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        {s.label}
                        {s.id === sortId && <Check className="h-2.5 w-2.5" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ── Results count ────────────────────────────────────── */}
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
          {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`}
        </p>

        {/* ── Grid ─────────────────────────────────────────────── */}
        <ProductGrid
          products={filtered}
          loading={loading}
          onPay={handlePay}
          onViewDetails={p => { setSelected(p); setModalOpen(true) }}
        />

        {/* ── Empty state ───────────────────────────────────────── */}
        {!loading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] border border-border bg-card text-2xl">
              🔍
            </div>
            <p className="text-[14px] font-semibold text-foreground">No products found</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Try a different filter or search</p>
            <Button variant="outline" size="sm" className="mt-4 h-7 rounded-lg text-[11px]"
              onClick={() => { setSearch(''); setCategory('all'); setOnSale(false) }}>
              Clear filters
            </Button>
          </motion.div>
        )}

      </div>

      <ProductDetailsModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => { setModalOpen(false); setSelected(null) }}
        onPay={handlePay}
        isProcessingPayment={isPaying}
      />
      <Toaster position="top-right" />
    </main>
  )
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
      <span className="text-primary">{icon}</span>
      <span className="font-semibold text-foreground">{value}</span>
      {label}
    </span>
  )
}

const CATEGORY_VISUAL: Record<ProductCategory, { bg: string; emoji: string }> = {
  THEME:     { bg: 'from-primary/20 via-primary/5 to-transparent',              emoji: '🎨' },
  STICKER:   { bg: 'from-[var(--twiky-cyan)]/20 via-[var(--twiky-cyan)]/5 to-transparent', emoji: '✨' },
  ROOM_ITEM: { bg: 'from-amber-500/20 via-amber-500/5 to-transparent',           emoji: '🏠' },
}

function FeaturedCard({ product, index, onClick }: { product: Product; index: number; onClick: () => void }) {
  const vis = CATEGORY_VISUAL[product.category]
  const hasImage = Array.isArray(product.images) && product.images.length > 0
  const img = hasImage ? product.images[0] : null
  const discounted = product.discount && product.discount > 0
    ? product.price * (1 - product.discount / 100)
    : product.price

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-[18px] border border-border bg-card text-left transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className={cn('relative h-24 w-full overflow-hidden bg-gradient-to-br', vis.bg)}>
        {img
          ? <img src={img} alt={product.title} className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105" />
          : <div className="flex h-full w-full items-center justify-center text-3xl">{vis.emoji}</div>
        }
        {product.discount && product.discount > 0 && (
          <span className="absolute right-2 top-2 rounded-md bg-primary px-1.5 py-px text-[9px] font-bold text-primary-foreground">
            -{product.discount}%
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-[11px] font-semibold text-foreground">{product.title}</p>
        <p className="mt-0.5 text-[12px] font-bold text-primary">${discounted.toFixed(2)}</p>
      </div>
    </motion.button>
  )
}
