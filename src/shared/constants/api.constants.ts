/**
 * API versioning constants
 */

export const API_VERSION = {
  V1: 'v1',
} as const;

export const API_PREFIX = '/api';

/**
 * API endpoint paths
 */

export const API_ENDPOINTS = {
  HEALTH: `${API_PREFIX}/${API_VERSION.V1}/health`,
  OPENAPI: `${API_PREFIX}/openapi`,
} as const;

/**
 * OpenAPI documentation constants
 */

export const OPENAPI_DOCS = {
  BASE_FILE: '_base.yaml',
  SCHEMAS_DIR: 'schemas',
  VERSIONS: [API_VERSION.V1],
} as const;
