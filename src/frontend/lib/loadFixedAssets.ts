/**
 * Utility to load Fixed Assets data from TestData
 */

import type { FixedAsset } from '@/src/shared/types/asset';

// Import Fixed Assets data from TestData
import fixedAssetsData from '@/src/tests/TestData/Dec/1231expense/FixedAssetsRegister_forDepreciation.json';

/**
 * Get all available fixed assets
 */
export function getFixedAssets(): FixedAsset[] {
  return fixedAssetsData.assetList as FixedAsset[];
}

/**
 * Get a fixed asset by ID
 */
export function getFixedAssetById(assetID: string): FixedAsset | undefined {
  const assets = getFixedAssets();
  return assets.find(asset => asset.assetID === assetID);
}

/**
 * Get asset options for select dropdown
 */
export function getAssetOptions(): Array<{ value: string; label: string }> {
  const assets = getFixedAssets();
  return assets.map(asset => ({
    value: asset.assetID,
    label: `${asset.assetID} - ${asset.assetName}`,
  }));
}
