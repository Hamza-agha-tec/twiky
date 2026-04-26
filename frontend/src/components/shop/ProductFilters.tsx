'use client';

import { useState } from 'react';
import { ProductCategory } from '@/types/product';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Search, Filter, X } from 'lucide-react';

interface ProductFiltersProps {
  onFiltersChange: (filters: ProductFilters) => void;
  loading?: boolean;
}

export interface ProductFilters {
  search: string;
  category: ProductCategory | 'all';
  priceRange: [number, number];
  onSale: boolean;
  sortBy: 'created_at' | 'price' | 'sales' | 'title';
  sortOrder: 'asc' | 'desc';
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'ROOM_ITEM', label: 'Room Items' },
  { value: 'STICKER', label: 'Stickers' },
  { value: 'THEME', label: 'Themes' },
];

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Newest First' },
  { value: 'price', label: 'Price: Low to High' },
  { value: 'sales', label: 'Most Popular' },
  { value: 'title', label: 'Alphabetical' },
];

export function ProductFilters({ onFiltersChange, loading = false }: ProductFiltersProps) {
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    category: 'all',
    priceRange: [0, 100],
    onSale: false,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  const updateFilters = (newFilters: Partial<ProductFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const resetFilters = () => {
    const defaultFilters: ProductFilters = {
      search: '',
      category: 'all',
      priceRange: [0, 100],
      onSale: false,
      sortBy: 'created_at',
      sortOrder: 'desc',
    };
    setFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  const activeFiltersCount = [
    filters.search,
    filters.category !== 'all',
    filters.priceRange[0] > 0 || filters.priceRange[1] < 100,
    filters.onSale,
  ].filter(Boolean).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount}</Badge>
            )}
          </CardTitle>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <Select
            value={filters.category}
            onValueChange={(value) => updateFilters({ category: value as ProductCategory | 'all' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Price Range */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Price Range: ${filters.priceRange[0]} - ${filters.priceRange[1]}
          </label>
          <Slider
            value={filters.priceRange}
            onValueChange={(value) => updateFilters({ priceRange: value as [number, number] })}
            max={100}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        {/* On Sale Toggle */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="onSale"
            checked={filters.onSale}
            onChange={(e) => updateFilters({ onSale: e.target.checked })}
            className="rounded"
          />
          <label htmlFor="onSale" className="text-sm font-medium cursor-pointer">
            On Sale Only
          </label>
        </div>

        {/* Sort */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Sort By</label>
          <Select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onValueChange={(value) => {
              const [sortBy, sortOrder] = value.split('-');
              updateFilters({ 
                sortBy: sortBy as ProductFilters['sortBy'],
                sortOrder: sortOrder as ProductFilters['sortOrder']
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={`${option.value}-${option.value === 'price' ? 'asc' : 'desc'}`}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
