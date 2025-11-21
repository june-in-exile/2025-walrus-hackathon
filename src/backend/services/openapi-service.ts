import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { OpenAPISpec, OpenAPIPath } from '@/src/shared/types/api.types';
import { OPENAPI_DOCS } from '@/src/shared/constants/api.constants';

/**
 * Service for generating OpenAPI specification
 */
export class OpenAPIService {
  private docsDir: string;

  constructor(docsDir?: string) {
    this.docsDir = docsDir || join(process.cwd(), 'docs');
  }

  /**
   * Generate complete OpenAPI specification by merging base config and all endpoint files
   */
  generateSpec(): OpenAPISpec {
    try {
      // Read base configuration
      const baseConfig = this.readBaseConfig();

      // Read all endpoint specification files
      const paths = this.mergeAllPaths();

      // Read all schemas
      const schemas = this.mergeAllSchemas();

      // Combine base config with merged paths and schemas
      const openapiSpec: OpenAPISpec = {
        ...baseConfig,
        paths,
        components: {
          ...(baseConfig.components || {}),
          schemas: {
            ...(baseConfig.components?.schemas || {}),
            ...schemas,
          },
        },
      };

      // Resolve all relative $ref paths to absolute paths
      const resolvedSpec = this.resolveRefs(openapiSpec);

      return resolvedSpec;
    } catch (error) {
      console.error('Error generating OpenAPI spec:', error);
      throw new Error(
        `Failed to generate OpenAPI specification: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Read and parse the base OpenAPI configuration
   */
  private readBaseConfig(): Omit<OpenAPISpec, 'paths'> {
    const baseFilePath = join(this.docsDir, OPENAPI_DOCS.BASE_FILE);

    if (!existsSync(baseFilePath)) {
      throw new Error(`Base configuration file not found: ${baseFilePath}`);
    }

    try {
      const content = readFileSync(baseFilePath, 'utf8');
      const config = yaml.load(content) as Omit<OpenAPISpec, 'paths'>;

      return config;
    } catch (error) {
      throw new Error(
        `Failed to parse base configuration: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Merge paths from all endpoint YAML files across all versions
   */
  private mergeAllPaths(): Record<string, OpenAPIPath> {
    const allPaths: Record<string, OpenAPIPath> = {};

    // Process each API version directory
    for (const version of OPENAPI_DOCS.VERSIONS) {
      const versionDir = join(this.docsDir, version);

      if (existsSync(versionDir)) {
        const versionPaths = this.readPathsFromDirectory(versionDir);
        Object.assign(allPaths, versionPaths);
      }
    }

    // Also read from root docs directory for backward compatibility
    const rootPaths = this.readPathsFromDirectory(this.docsDir);
    Object.assign(allPaths, rootPaths);

    return allPaths;
  }

  /**
   * Read all YAML files from a directory and extract paths
   */
  private readPathsFromDirectory(directory: string): Record<string, OpenAPIPath> {
    const paths: Record<string, OpenAPIPath> = {};

    if (!existsSync(directory)) {
      return paths;
    }

    try {
      const files = readdirSync(directory).filter(
        (file) =>
          file.endsWith('.yaml') &&
          !file.startsWith('_') &&
          file !== OPENAPI_DOCS.BASE_FILE
      );

      for (const file of files) {
        const filePath = join(directory, file);
        try {
          const content = readFileSync(filePath, 'utf8');
          const parsed = yaml.load(content) as { paths?: Record<string, OpenAPIPath> };

          if (parsed?.paths) {
            Object.assign(paths, parsed.paths);
          }
        } catch (error) {
          console.warn(`Warning: Failed to parse ${file}:`, error);
          // Continue processing other files
        }
      }
    } catch (error) {
      console.warn(`Warning: Failed to read directory ${directory}:`, error);
    }

    return paths;
  }

  /**
   * Merge schemas from all schema YAML files
   */
  private mergeAllSchemas(): Record<string, unknown> {
    const allSchemas: Record<string, unknown> = {};

    // Read from schemas directory
    const schemasDir = join(this.docsDir, OPENAPI_DOCS.SCHEMAS_DIR);
    const schemas = this.readSchemasFromDirectory(schemasDir);
    Object.assign(allSchemas, schemas);

    return allSchemas;
  }

  /**
   * Read all YAML files from schemas directory and extract schemas
   */
  private readSchemasFromDirectory(directory: string): Record<string, unknown> {
    const schemas: Record<string, unknown> = {};

    if (!existsSync(directory)) {
      return schemas;
    }

    try {
      const files = readdirSync(directory).filter((file) =>
        file.endsWith('.yaml')
      );

      for (const file of files) {
        const filePath = join(directory, file);
        try {
          const content = readFileSync(filePath, 'utf8');
          const parsed = yaml.load(content) as { components?: { schemas?: Record<string, unknown> } };

          if (parsed?.components?.schemas) {
            Object.assign(schemas, parsed.components.schemas);
          }
        } catch (error) {
          console.warn(`Warning: Failed to parse schema file ${file}:`, error);
          // Continue processing other files
        }
      }
    } catch (error) {
      console.warn(`Warning: Failed to read schemas directory ${directory}:`, error);
    }

    return schemas;
  }

  /**
   * Resolve all relative $ref paths to absolute paths
   * Converts refs like "./schemas/period.yaml#/components/schemas/Period"
   * to "#/components/schemas/Period"
   */
  private resolveRefs<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveRefs(item)) as unknown as T;
    }

    const resolved: { [key: string]: unknown } = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key as keyof typeof obj];
        if (key === '$ref' && typeof value === 'string') {
          // Resolve relative $ref to absolute path
          resolved[key] = this.resolveRefPath(value);
        } else {
          resolved[key] = this.resolveRefs(value);
        }
      }
    }

    return resolved as T;
  }

  /**
   * Convert relative $ref path to absolute path
   * Examples:
   *   "./period.yaml#/components/schemas/Period" -> "#/components/schemas/Period"
   *   "../schemas/errors.yaml#/components/schemas/ErrorResponse" -> "#/components/schemas/ErrorResponse"
   *   "#/components/schemas/Deal" -> "#/components/schemas/Deal" (unchanged)
   */
  private resolveRefPath(ref: string): string {
    // If already an absolute path (starts with #), return as-is
    if (ref.startsWith('#')) {
      return ref;
    }

    // Extract the fragment part after # (e.g., "/components/schemas/Period")
    const hashIndex = ref.indexOf('#');
    if (hashIndex === -1) {
      // No fragment, cannot resolve
      console.warn(`Warning: Cannot resolve $ref without fragment: ${ref}`);
      return ref;
    }

    const fragment = ref.substring(hashIndex);
    return fragment;
  }
}

/**
 * Singleton instance for the OpenAPI service
 */
export const openAPIService = new OpenAPIService();
