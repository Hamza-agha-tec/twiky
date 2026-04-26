export enum ProductCategory {
  ROOM_ITEM = 'ROOM_ITEM',
  STICKER = 'STICKER',
  THEME = 'THEME'
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: ProductCategory;
  features: string[];
  slug: string;
  active: boolean;
  sales: number;
  dodo_product_id: string;
  discount?: number;
  images?: any;
  created_at: string;
}

export interface CreateProductDto {
  title: string;
  description: string;
  price: number;
  category: ProductCategory;
  features: string[];
  slug: string;
  active: boolean;
  dodo_product_id: string;
  discount?: number;
  images?: any;
}

export interface UpdateProductDto {
  title?: string;
  description?: string;
  price?: number;
  category?: ProductCategory;
  features?: string[];
  slug?: string;
  active?: boolean;
  sales?: number;
  dodo_product_id?: string;
  discount?: number;
  images?: any;
}
