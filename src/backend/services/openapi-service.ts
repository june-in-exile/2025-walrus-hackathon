import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { OpenAPISpec } from '@/src/shared/types/api.types';
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

      return openapiSpec;
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
  private mergeAllPaths(): Record<string, any> {
    const allPaths: Record<string, any> = {};

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
  private readPathsFromDirectory(directory: string): Record<string, any> {
    const paths: Record<string, any> = {};

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
          const parsed = yaml.load(content) as any;

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
  private mergeAllSchemas(): Record<string, any> {
    const allSchemas: Record<string, any> = {};

    // Read from schemas directory
    const schemasDir = join(this.docsDir, OPENAPI_DOCS.SCHEMAS_DIR);
    const schemas = this.readSchemasFromDirectory(schemasDir);
    Object.assign(allSchemas, schemas);

    return allSchemas;
  }

  /**
   * Read all YAML files from schemas directory and extract schemas
   */
  private readSchemasFromDirectory(directory: string): Record<string, any> {
    const schemas: Record<string, any> = {};

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
          const parsed = yaml.load(content) as any;

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
}

/**
 * Singleton instance for the OpenAPI service
 */
export const openAPIService = new OpenAPIService();
