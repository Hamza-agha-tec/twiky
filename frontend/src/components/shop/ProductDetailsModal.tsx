'use client';

import { Product, ProductCategory } from '@/types/product';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Star, Package, Tag } from 'lucide-react';

interface ProductDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onPay?: (product: Product) => void;
  isProcessingPayment?: boolean;
}

const categoryColors: Record<ProductCategory, string> = {
  ROOM_ITEM: 'bg-blue-100 text-blue-800',
  STICKER: 'bg-green-100 text-green-800',
  THEME: 'bg-purple-100 text-purple-800',
};

export function ProductDetailsModal({ 
  product, 
  isOpen, 
  onClose, 
  onPay,
  isProcessingPayment = false
}: ProductDetailsModalProps) {
  if (!product) return null;

  const discountedPrice = product.discount && product.discount > 0
    ? product.price * (1 - product.discount / 100)
    : product.price;

  const mainImage = Array.isArray(product.images) && product.images.length > 0 
    ? product.images[0] 
    : '/placeholder-product.jpg';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{product.title}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Image */}
          <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
            <img
              src={mainImage}
              alt={product.title}
              className="w-full h-full object-cover"
            />
            {product.discount && product.discount > 0 && (
              <Badge className="absolute top-4 right-4 bg-red-500 text-white text-lg px-3 py-1">
                -{product.discount}%
              </Badge>
            )}
            {product.sales > 0 && (
              <Badge variant="secondary" className="absolute top-4 left-4 text-lg px-3 py-1">
                <Star className="w-4 h-4 mr-1" />
                Popular
              </Badge>
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            {/* Category and Status */}
            <div className="flex items-center gap-3">
              <Badge className={categoryColors[product.category]} variant="secondary">
                {product.category.replace('_', ' ')}
              </Badge>
              <Badge variant={product.active ? "default" : "secondary"}>
                {product.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </div>

            <Separator />

            {/* Pricing */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Price</h3>
              <div className="flex items-center gap-3">
                {product.discount && product.discount > 0 ? (
                  <>
                    <span className="text-3xl font-bold text-primary">
                      ${discountedPrice.toFixed(2)}
                    </span>
                    <span className="text-xl line-through text-muted-foreground">
                      ${product.price.toFixed(2)}
                    </span>
                    <Badge className="bg-green-100 text-green-800">
                      Save ${(product.price - discountedPrice).toFixed(2)}
                    </Badge>
                  </>
                ) : (
                  <span className="text-3xl font-bold text-primary">
                    ${product.price.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            <Separator />

            {/* Product Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Product Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Product ID</p>
                    <p className="font-medium text-sm">{product.dodo_product_id}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Sales</p>
                    <p className="font-medium text-sm">{product.sales} sold</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Slug</p>
                    <p className="font-medium text-sm">{product.slug}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium text-sm">
                      {new Date(product.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Images */}
            {Array.isArray(product.images) && product.images.length > 1 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-3">Additional Images</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {product.images.slice(1).map((image, index) => (
                      <div key={index} className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                        <img
                          src={image}
                          alt={`${product.title} - Image ${index + 2}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                size="lg"
                className="flex-1"
                onClick={() => onPay?.(product)}
                disabled={!product.active || isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <>
                    <div className="w-5 h-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Pay Now
                  </>
                )}
              </Button>
              <Button variant="outline" size="lg" onClick={onClose} disabled={isProcessingPayment}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
