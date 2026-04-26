import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { ProductDto, CreateProductDto, UpdateProductDto, ProductCategory } from './dto/product.dto';

@Injectable()
export class StoreService {
    constructor(
        private readonly supabaseService: SupabaseService,
    ) {}

    async getAllProducts(): Promise<ProductDto[]> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch products: ${error.message}`);
        }

        return data || [];
    }

    async getProductById(id: string): Promise<ProductDto> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException('Product not found');
        }

        return data;
    }

    async getProductBySlug(slug: string): Promise<ProductDto> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('products')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error || !data) {
            throw new NotFoundException('Product not found');
        }

        return data;
    }

    async getProductsByCategory(category: ProductCategory): Promise<ProductDto[]> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('products')
            .select('*')
            .eq('category', category)
            .eq('active', true)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch products by category: ${error.message}`);
        }

        return data || [];
    }

    async getActiveProducts(): Promise<ProductDto[]> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('products')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch active products: ${error.message}`);
        }

        return data || [];
    }

    async getFeaturedProducts(limit: number = 10): Promise<ProductDto[]> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('products')
            .select('*')
            .eq('active', true)
            .gt('sales', 0)
            .order('sales', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Failed to fetch featured products: ${error.message}`);
        }

        return data || [];
    }

    async searchProducts(query: string): Promise<ProductDto[]> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('products')
            .select('*')
            .eq('active', true)
            .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to search products: ${error.message}`);
        }

        return data || [];
    }

    async createProduct(createProductDto: CreateProductDto): Promise<ProductDto> {
        // Check if product with same slug already exists
        const existingProduct = await this.getProductBySlug(createProductDto.slug).catch(() => null);
        if (existingProduct) {
            throw new BadRequestException('Product with this slug already exists');
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('products')
            .insert({
                ...createProductDto,
                sales: 0,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create product: ${error.message}`);
        }

        return data;
    }

    async updateProduct(id: string, updateProductDto: UpdateProductDto): Promise<ProductDto> {
        // Check if product exists
        await this.getProductById(id);

        // If slug is being updated, check for duplicates
        if (updateProductDto.slug) {
            const existingProduct = await this.getProductBySlug(updateProductDto.slug).catch(() => null);
            if (existingProduct && existingProduct.id !== id) {
                throw new BadRequestException('Product with this slug already exists');
            }
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('products')
            .update(updateProductDto)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update product: ${error.message}`);
        }

        return data;
    }

    async deleteProduct(id: string): Promise<void> {
        // Check if product exists
        await this.getProductById(id);

        const { error } = await this.supabaseService
            .getClient()
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to delete product: ${error.message}`);
        }
    }

    async getProductsByPriceRange(minPrice: number, maxPrice: number): Promise<ProductDto[]> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('products')
            .select('*')
            .eq('active', true)
            .gte('price', minPrice)
            .lte('price', maxPrice)
            .order('price', { ascending: true });

        if (error) {
            throw new Error(`Failed to fetch products by price range: ${error.message}`);
        }

        return data || [];
    }

    async getProductsOnSale(): Promise<ProductDto[]> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('products')
            .select('*')
            .eq('active', true)
            .gt('discount', 0)
            .order('discount', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch products on sale: ${error.message}`);
        }

        return data || [];
    }
}
