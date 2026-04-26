'use client';

import { useState, useEffect } from 'react';
import { Product, ProductCategory } from '@/types/product';
import { productsAPI } from '@/lib/api/products';
import { paymentsAPI } from '@/lib/api/payments';
import { ProductGrid } from '@/components/shop/ProductGrid';
import { ProductFilters, ProductFilters as ProductFiltersType } from '@/components/shop/ProductFilters';
import { ProductDetailsModal } from '@/components/shop/ProductDetailsModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast, Toaster } from 'sonner';
import { CreditCard, Star, Package } from 'lucide-react';

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [filters, setFilters] = useState<ProductFiltersType>({
    search: '',
    category: 'all',
    priceRange: [0, 100],
    onSale: false,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let fetchedProducts: Product[] = [];

      // Apply filters
      if (filters.search) {
        fetchedProducts = await productsAPI.searchProducts(filters.search);
      } else if (filters.category !== 'all') {
        fetchedProducts = await productsAPI.getProductsByCategory(filters.category as ProductCategory);
      } else if (filters.onSale) {
        fetchedProducts = await productsAPI.getProductsOnSale();
      } else {
        fetchedProducts = await productsAPI.getActiveProducts();
      }

      // Apply price range filter
      if (filters.priceRange[0] > 0 || filters.priceRange[1] < 100) {
        fetchedProducts = fetchedProducts.filter(
          (product) => product.price >= filters.priceRange[0] && product.price <= filters.priceRange[1]
        );
      }

      // Apply sorting
      fetchedProducts.sort((a, b) => {
        let aValue: any = a[filters.sortBy];
        let bValue: any = b[filters.sortBy];

        if (filters.sortBy === 'created_at') {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        if (filters.sortOrder === 'desc') {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        } else {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
      });

      setProducts(fetchedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      const featured = await productsAPI.getFeaturedProducts(4);
      setFeaturedProducts(featured);
    } catch (error) {
      console.error('Error fetching featured products:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchFeaturedProducts();
  }, [filters]);

  const handlePay = async (product: Product) => {
    if (isProcessingPayment) return;
    
    setIsProcessingPayment(true);
    
    try {
      
      // Create checkout session
      const checkoutResponse = await paymentsAPI.createProductCheckout({
        product_id: product.id,
        currency: 'USD',
        redirect_url: `${window.location.origin}/shop?payment=success`,
        cancel_url: `${window.location.origin}/shop?payment=cancelled`,
      });
      
      // Show success message
      toast.success('Redirecting to payment...');
      
      // Redirect to checkout
      setTimeout(() => {
        window.location.href = checkoutResponse.checkout_url;
      }, 1000);
      
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to process payment. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleViewDetails = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleFiltersChange = (newFilters: ProductFiltersType) => {
    setFilters(newFilters);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Shop</h1>
        <p className="text-muted-foreground text-lg">
          Discover amazing products for your workspace and personal style
        </p>
      </div>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-semibold">Featured Products</h2>
          </div>
          <ProductGrid
            products={featuredProducts}
            loading={false}
            onPay={handlePay}
            onViewDetails={handleViewDetails}
          />
        </section>
      )}

      {/* Main Shop Content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters Sidebar */}
        <aside className="w-full lg:w-80 flex-shrink-0">
          <ProductFilters
            onFiltersChange={handleFiltersChange}
            loading={loading}
          />
        </aside>

        {/* Products Grid */}
        <main className="flex-1">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold">Products</h2>
              <p className="text-muted-foreground">
                {loading ? 'Loading...' : `${products.length} products found`}
              </p>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Products</p>
                    <p className="font-semibold">{products.length}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">On Sale</p>
                    <p className="font-semibold">
                      {products.filter(p => p.discount && p.discount > 0).length}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Products */}
          <ProductGrid
            products={products}
            loading={loading}
            onPay={handlePay}
            onViewDetails={handleViewDetails}
          />

          {/* Empty State */}
          {!loading && products.length === 0 && (
            <Card className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No products found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters or search terms to find what you're looking for.
              </p>
              <Button onClick={() => handleFiltersChange({
                search: '',
                category: 'all',
                priceRange: [0, 100],
                onSale: false,
                sortBy: 'created_at',
                sortOrder: 'desc',
              })}>
                Clear Filters
              </Button>
            </Card>
          )}
        </main>
      </div>

      {/* Product Details Modal */}
      <ProductDetailsModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onPay={handlePay}
        isProcessingPayment={isProcessingPayment}
      />
      <Toaster position="top-right" />
    </div>
  );
}
