/**
 * Common API response types
 */

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * OpenAPI specification types
 */

export interface OpenAPIInfo {
  title: string;
  version: string;
  description: string;
}

export interface OpenAPIServer {
  url: string;
  description: string;
}

export interface OpenAPIPath {
  [key: string]: any;
}

export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers: OpenAPIServer[];
  paths: Record<string, OpenAPIPath>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}
