'use client';

import { Product, ProductCategory } from '@/types/product';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, CreditCard, Tag } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onPay?: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
}

const categoryColors: Record<ProductCategory, string> = {
  ROOM_ITEM: 'bg-blue-100 text-blue-800',
  STICKER: 'bg-green-100 text-green-800',
  THEME: 'bg-purple-100 text-purple-800',
};

export function ProductCard({ product, onPay, onViewDetails }: ProductCardProps) {
  const discountedPrice = product.discount && product.discount > 0
    ? product.price * (1 - product.discount / 100)
    : product.price;

  const mainImage = Array.isArray(product.images) && product.images.length > 0 
    ? product.images[0] 
    : '/placeholder-product.jpg';

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="p-0">
        <div className="relative aspect-square overflow-hidden">
          <img
            src={mainImage}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
          {product.discount && product.discount > 0 && (
            <Badge className="absolute top-2 right-2 bg-red-500 text-white">
              -{product.discount}%
            </Badge>
          )}
          {product.sales > 0 && (
            <Badge variant="secondary" className="absolute top-2 left-2">
              <Star className="w-3 h-3 mr-1" />
              Popular
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="space-y-2">
          <Badge className={categoryColors[product.category]}>
            {product.category.replace('_', ' ')}
          </Badge>
          
          <h3 className="font-semibold text-lg line-clamp-2">{product.title}</h3>
          
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
          
          <div className="flex items-center gap-2">
            {product.discount && product.discount > 0 ? (
              <>
                <span className="text-lg font-bold text-primary">
                  ${discountedPrice.toFixed(2)}
                </span>
                <span className="text-sm line-through text-muted-foreground">
                  ${product.price.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-lg font-bold text-primary">
                ${product.price.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onViewDetails?.(product)}
          >
            View Details
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onPay?.(product)}
            disabled={!product.active}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Pay Now
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
