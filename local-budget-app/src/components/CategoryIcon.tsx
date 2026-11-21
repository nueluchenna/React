import React from 'react';
import {
  ShoppingCart,
  Utensils,
  TrainFront,
  ShoppingBag,
  Home,
  Zap,
  Film,
  HeartPulse,
  Plane,
  ArrowDownLeft,
  Tag,
} from 'lucide-react';
import type { SpendeeCategory } from '../db/db';

interface CategoryIconProps {
  category: SpendeeCategory;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  className = 'w-4 h-4',
}) => {
  switch (category) {
    case 'Groceries':
      return <ShoppingCart className={className} />;
    case 'Food & Drink':
      return <Utensils className={className} />;
    case 'Transport':
      return <TrainFront className={className} />;
    case 'Shopping':
      return <ShoppingBag className={className} />;
    case 'Housing':
      return <Home className={className} />;
    case 'Utilities':
      return <Zap className={className} />;
    case 'Entertainment':
      return <Film className={className} />;
    case 'Health':
      return <HeartPulse className={className} />;
    case 'Travel':
      return <Plane className={className} />;
    case 'Income':
      return <ArrowDownLeft className={className} />;
    default:
      return <Tag className={className} />;
  }
};
