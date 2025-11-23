/**
 * Environment Configuration
 *
 * Centralized configuration for all environment variables.
 * This file provides type-safe access to environment variables with validation.
 */

import { EncryptionMode } from '../types/walrus';

/**
 * Sui Network types
 */
export type SuiNetwork = 'devnet' | 'testnet' | 'mainnet';

/**
 * Get environment variable with fallback
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue || '';
}

/**
 * Get optional environment variable
 */
function getOptionalEnvVar(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

/**
 * Parse boolean environment variable
 */
function parseBooleanEnv(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse integer environment variable
 */
function parseIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid integer for ${key}: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

/**
 * Sui blockchain configuration
 */
export const suiConfig = {
  /**
   * Sui network (devnet, testnet, mainnet)
   */
  network: getOptionalEnvVar('SUI_NETWORK', 'testnet') as SuiNetwork,

  /**
   * Sui RPC endpoint URL
   */
  rpcUrl: getOptionalEnvVar(
    'SUI_RPC_URL',
    process.env.SUI_NETWORK === 'mainnet'
      ? 'https://fullnode.mainnet.sui.io:443'
      : process.env.SUI_NETWORK === 'devnet'
        ? 'https://fullnode.devnet.sui.io:443'
        : 'https://fullnode.testnet.sui.io:443'
  ),

  /**
   * Backend private key for server-side operations
   * WARNING: Only use for non-critical operations
   */
  backendPrivateKey: getOptionalEnvVar('SUI_BACKEND_PRIVATE_KEY'),
};

/**
 * Walrus storage configuration
 */
export const walrusConfig = {
  /**
   * Walrus aggregator URL for uploads
   */
  aggregatorUrl: getEnvVar('WALRUS_AGGREGATOR_URL', 'https://walrus-testnet.blockscope.net'),

  /**
   * Walrus publisher URL (optional, uses aggregator if not set)
   */
  publisherUrl: getOptionalEnvVar('WALRUS_PUBLISHER_URL'),

  /**
   * Walrus API key (if required)
   */
  apiKey: getOptionalEnvVar('WALRUS_API_KEY'),

  /**
   * Number of epochs to store blobs
   */
  storageEpochs: parseIntEnv('WALRUS_STORAGE_EPOCHS', 1),

  /**
   * Maximum file size for uploads in bytes (default: 100MB)
   */
  maxFileSize: parseIntEnv('WALRUS_MAX_FILE_SIZE', 100 * 1024 * 1024),
};

/**
 * Seal encryption configuration
 */
export const sealConfig = {
  /**
   * Seal Key Server URL
   */
  keyServerUrl: getEnvVar('SEAL_KEY_SERVER_URL', 'https://seal-keyserver-testnet.sui.io'),

  /**
   * Seal encryption mode: frontend, backend, or hybrid
   */
  encryptionMode: getOptionalEnvVar('SEAL_ENCRYPTION_MODE', 'hybrid') as 'frontend' | 'backend' | 'hybrid',
};

/**
 * Earnout contract configuration
 */
export const earnoutConfig = {
  /**
   * Package ID where earnout module is deployed
   */
  packageId: getEnvVar('EARNOUT_PACKAGE_ID'),
};

/**
 * Application configuration
 */
export const appConfig = {
  /**
   * Default upload mode for /walrus/upload endpoint
   */
  defaultUploadMode: getOptionalEnvVar('DEFAULT_UPLOAD_MODE', 'client_encrypted') as EncryptionMode,

  /**
   * Enable server-side encryption option
   */
  enableServerEncryption: parseBooleanEnv('ENABLE_SERVER_ENCRYPTION', true),

  /**
   * JWT secret for API authentication
   */
  jwtSecret: getEnvVar('JWT_SECRET', 'dev-secret-change-in-production'),

  /**
   * API request timeout in milliseconds
   */
  apiTimeout: parseIntEnv('API_TIMEOUT', 30000),
};

/**
 * Debug configuration
 */
export const debugConfig = {
  /**
   * Enable debug logging for Walrus operations
   */
  walrus: parseBooleanEnv('DEBUG_WALRUS', false),

  /**
   * Enable debug logging for Seal operations
   */
  seal: parseBooleanEnv('DEBUG_SEAL', false),

  /**
   * Enable debug logging for Sui blockchain operations
   */
  sui: parseBooleanEnv('DEBUG_SUI', false),

  /**
   * Enable verbose API logging
   */
  api: parseBooleanEnv('DEBUG_API', false),
};

/**
 * Complete application configuration
 */
export const config = {
  sui: suiConfig,
  walrus: walrusConfig,
  seal: sealConfig,
  earnout: earnoutConfig,
  app: appConfig,
  debug: debugConfig,
} as const;

/**
 * Validate required environment variables
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Check Walrus configuration
  if (!walrusConfig.aggregatorUrl) {
    errors.push('WALRUS_AGGREGATOR_URL is required');
  }

  // Check Seal configuration if server encryption is enabled
  if (appConfig.enableServerEncryption) {
    if (!sealConfig.keyServerUrl) {
      errors.push('SEAL_KEY_SERVER_URL is required when server encryption is enabled');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Log current configuration (for debugging)
 */
export function logConfig(): void {
  if (!debugConfig.api) return;

  console.log('=== Application Configuration ===');
  console.log('Sui Network:', suiConfig.network);
  console.log('Sui RPC URL:', suiConfig.rpcUrl);
  console.log('Walrus Aggregator:', walrusConfig.aggregatorUrl);
  console.log('Seal Key Server:', sealConfig.keyServerUrl);
  console.log('Seal Encryption Mode:', sealConfig.encryptionMode);
  console.log('Default Upload Mode:', appConfig.defaultUploadMode);
  console.log('Server Encryption Enabled:', appConfig.enableServerEncryption);
  console.log('================================');
}

// Validate configuration on module load in production
if (process.env.NODE_ENV === 'production') {
  validateConfig();
}
