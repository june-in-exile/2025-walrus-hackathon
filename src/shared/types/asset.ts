/**
 * Asset types for Fixed Assets management
 */

/**
 * Fixed Asset information from Fixed_Asset.json
 */
export interface FixedAsset {
  assetID: string;
  assetName: string;
  originalCost: number;
  acquisitionDate: string;
  usefulLife_years: number;
  depreciationMethod: string;
  residualValue: number;
  accumulatedDepreciation: number;
  netBookValue: number;
}

/**
 * Asset reference in Deal metadata
 * Links to a Fixed Asset and specifies its estimated useful life for depreciation calculation
 */
export interface AssetReference {
  assetID: string;
  assetName?: string;
  originalCost: number;
  acquisitionDate?: string;
  estimatedUsefulLife_months: number; // User-specified useful life in months for this deal
}

/**
 * Deal metadata structure with assets
 */
export interface DealMetadataWithAssets {
  assets?: AssetReference[];
  [key: string]: any;
}

/**
 * Calculate monthly depreciation for a single asset
 * Formula: originalCost / estimatedUsefulLife_months
 */
export function calculateMonthlyDepreciation(asset: AssetReference): number {
  if (asset.estimatedUsefulLife_months <= 0) {
    return 0;
  }
  return asset.originalCost / asset.estimatedUsefulLife_months;
}

/**
 * Calculate total monthly depreciation for all assets
 */
export function calculateTotalMonthlyDepreciation(assets: AssetReference[]): number {
  return assets.reduce((total, asset) => total + calculateMonthlyDepreciation(asset), 0);
}
