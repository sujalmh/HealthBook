/**
 * Healthbook Types: Drug Knowledge Shapes (NO bundled data).
 *
 * Clinical content comes exclusively from the AI pipeline
 * (ClinicalInteractionEngine + verified prompt rubrics). This module keeps
 * only the TypeScript shapes so tools, components, and tests share types.
 * There are no hardcoded drug tables here by design.
 */

export interface BrandGenericMapping {
  generic: string;
  class: string;
  standardDoses: string[];
  activeIngredients: { ingredient: string; amountMg: number }[];
}

// NOTE: No drug tables live here. Brand/generic resolution, interaction
// detection, diet flags, and duplicate analysis are produced per-request by
// the AI pipeline (see src/core/knowledge/interactionEngine.ts). Test mocks
// that simulate AI responses live in test setup/shim files, not in src/.
