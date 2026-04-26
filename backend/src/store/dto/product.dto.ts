import { IsUUID, IsString, IsNumber, IsBoolean, IsArray, IsOptional, IsEnum, Min, Max } from 'class-validator';

export enum ProductCategory {
  ROOM_ITEM = 'ROOM_ITEM',
  STICKER = 'STICKER',
  THEME = 'THEME'
}

export class ProductDto {
  @IsUUID()
  id: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsEnum(ProductCategory)
  category: ProductCategory;

  @IsArray()
  @IsString({ each: true })
  features: string[];

  @IsString()
  slug: string;

  @IsBoolean()
  active: boolean;

  @IsNumber()
  @Min(0)
  sales: number;

  @IsString()
  dodo_product_id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;

  @IsOptional()
  images?: any;

  created_at: Date;
}

export class CreateProductDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsEnum(ProductCategory)
  category: ProductCategory;

  @IsArray()
  @IsString({ each: true })
  features: string[];

  @IsString()
  slug: string;

  @IsBoolean()
  active: boolean;

  @IsString()
  dodo_product_id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;

  @IsOptional()
  images?: any;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sales?: number;

  @IsOptional()
  @IsString()
  dodo_product_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;

  @IsOptional()
  images?: any;
}
