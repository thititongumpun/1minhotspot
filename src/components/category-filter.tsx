"use client";

import { Button } from "@/components/ui/button";
import { Category } from "@/types/NewsItem";

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: Category;
  onCategoryChange: (category: Category) => void;
  loading?: boolean;
}

export default function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
  loading = false,
}: CategoryFilterProps) {
  return (
    <nav className="mb-8" role="navigation" aria-label="News categories">
      <div className="flex flex-wrap gap-3">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            onClick={() => onCategoryChange(category)}
            className={`transition-all duration-200 ${
              selectedCategory === category
                ? "bg-slate-900 hover:bg-slate-800 shadow-lg"
                : "hover:bg-slate-100 hover:border-slate-300"
            }`}
            disabled={loading}
            aria-pressed={selectedCategory === category}
            aria-label={`Filter by ${category} news`}
          >
            {category}
          </Button>
        ))}
      </div>
    </nav>
  );
}
