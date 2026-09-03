
export interface BrandGenericMapping {
  generic: string;
  class: string;
  standardDoses: string[];
  activeIngredients: { ingredient: string; amountMg: number }[];
}

