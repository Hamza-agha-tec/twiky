import { 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete,
    Param, 
    Body, 
    Query,
    ValidationPipe,
    ParseUUIDPipe,
    HttpStatus,
    HttpCode
} from '@nestjs/common';
import { StoreService } from './store.service';
import { ProductDto, CreateProductDto, UpdateProductDto, ProductCategory } from './dto/product.dto';

@Controller('store')
export class StoreController {
    constructor(private readonly storeService: StoreService) {}

    @Get('products')
    async getAllProducts(): Promise<ProductDto[]> {
        return this.storeService.getAllProducts();
    }

    @Get('products/active')
    async getActiveProducts(): Promise<ProductDto[]> {
        return this.storeService.getActiveProducts();
    }

    @Get('products/featured')
    async getFeaturedProducts(
        @Query('limit') limit?: string
    ): Promise<ProductDto[]> {
        const parsedLimit = limit ? parseInt(limit, 10) : 10;
        return this.storeService.getFeaturedProducts(parsedLimit);
    }

    @Get('products/category/:category')
    async getProductsByCategory(
        @Param('category') category: ProductCategory
    ): Promise<ProductDto[]> {
        return this.storeService.getProductsByCategory(category);
    }

    @Get('products/search')
    async searchProducts(
        @Query('q') query: string
    ): Promise<ProductDto[]> {
        if (!query) {
            return [];
        }
        return this.storeService.searchProducts(query);
    }

    @Get('products/price-range')
    async getProductsByPriceRange(
        @Query('min') minPrice: string,
        @Query('max') maxPrice: string
    ): Promise<ProductDto[]> {
        const min = parseFloat(minPrice);
        const max = parseFloat(maxPrice);
        
        if (isNaN(min) || isNaN(max) || min < 0 || max < 0 || min > max) {
            throw new Error('Invalid price range');
        }
        
        return this.storeService.getProductsByPriceRange(min, max);
    }

    @Get('products/on-sale')
    async getProductsOnSale(): Promise<ProductDto[]> {
        return this.storeService.getProductsOnSale();
    }

    @Get('products/:id')
    async getProductById(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<ProductDto> {
        return this.storeService.getProductById(id);
    }

    @Get('products/slug/:slug')
    async getProductBySlug(
        @Param('slug') slug: string
    ): Promise<ProductDto> {
        return this.storeService.getProductBySlug(slug);
    }

    @Post('products')
    @HttpCode(HttpStatus.CREATED)
    async createProduct(
        @Body(ValidationPipe) createProductDto: CreateProductDto
    ): Promise<ProductDto> {
        return this.storeService.createProduct(createProductDto);
    }

    @Put('products/:id')
    async updateProduct(
        @Param('id', ParseUUIDPipe) id: string,
        @Body(ValidationPipe) updateProductDto: UpdateProductDto
    ): Promise<ProductDto> {
        return this.storeService.updateProduct(id, updateProductDto);
    }

    @Delete('products/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteProduct(
        @Param('id', ParseUUIDPipe) id: string
    ): Promise<void> {
        return this.storeService.deleteProduct(id);
    }
}
