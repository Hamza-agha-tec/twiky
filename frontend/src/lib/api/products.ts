import { Product, ProductCategory, CreateProductDto, UpdateProductDto } from '@/types/product';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

class ProductsAPI {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}/store${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getAllProducts(): Promise<Product[]> {
    return this.request<Product[]>('/products');
  }

  async getActiveProducts(): Promise<Product[]> {
    return this.request<Product[]>('/products/active');
  }

  async getFeaturedProducts(limit?: number): Promise<Product[]> {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<Product[]>(`/products/featured${query}`);
  }

  async getProductsByCategory(category: ProductCategory): Promise<Product[]> {
    return this.request<Product[]>(`/products/category/${category}`);
  }

  async searchProducts(query: string): Promise<Product[]> {
    return this.request<Product[]>(`/products/search?q=${encodeURIComponent(query)}`);
  }

  async getProductsByPriceRange(minPrice: number, maxPrice: number): Promise<Product[]> {
    return this.request<Product[]>(`/products/price-range?min=${minPrice}&max=${maxPrice}`);
  }

  async getProductsOnSale(): Promise<Product[]> {
    return this.request<Product[]>('/products/on-sale');
  }

  async getProductById(id: string): Promise<Product> {
    return this.request<Product>(`/products/${id}`);
  }

  async getProductBySlug(slug: string): Promise<Product> {
    return this.request<Product>(`/products/slug/${slug}`);
  }

  async createProduct(productData: CreateProductDto): Promise<Product> {
    return this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  }

  async updateProduct(id: string, productData: UpdateProductDto): Promise<Product> {
    return this.request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  }

  async deleteProduct(id: string): Promise<void> {
    return this.request<void>(`/products/${id}`, {
      method: 'DELETE',
    });
  }
}

export const productsAPI = new ProductsAPI();
