import type {
  JsonSchema,
  ObjectSchema,
  ToolParametersSchema,
} from "../../types/schema.js";

export interface ToolSchemaDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolParametersSchema;
  };
}

export abstract class Tool {
  abstract get name(): string;
  abstract get description(): string;
  abstract get parameters(): ToolParametersSchema;
  abstract execute(params: Record<string, unknown>): Promise<string>;

  castParams(params: Record<string, unknown>): Record<string, unknown> {
    return this.castObject(params, this.parameters);
  }

  validateParams(params: unknown): string[] {
    if (!this.isRecord(params)) {
      return [`parameters must be an object, got ${this.getValueType(params)}`];
    }

    return this.validateValue(params, this.parameters, "");
  }

  toSchema(): ToolSchemaDefinition {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }

  private castObject(
    value: Record<string, unknown>,
    schema: ObjectSchema,
  ): Record<string, unknown> {
    const properties = schema.properties ?? {};
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      const propertySchema = properties[key];
      result[key] =
        propertySchema === undefined
          ? entry
          : this.castValue(entry, propertySchema);
    }

    return result;
  }

  private castValue(value: unknown, schema: JsonSchema): unknown {
    switch (schema.type) {
      case "string":
        return value === null ? value : String(value);
      case "integer":
        if (typeof value === "number" && Number.isInteger(value)) {
          return value;
        }
        if (typeof value === "string") {
          const parsed = Number.parseInt(value, 10);
          return Number.isNaN(parsed) ? value : parsed;
        }
        return value;
      case "number":
        if (typeof value === "number" && !Number.isNaN(value)) {
          return value;
        }
        if (typeof value === "string") {
          const parsed = Number(value);
          return Number.isNaN(parsed) ? value : parsed;
        }
        return value;
      case "boolean":
        if (typeof value === "boolean") {
          return value;
        }
        if (typeof value === "string") {
          const lowered = value.toLowerCase();
          if (["true", "1", "yes"].includes(lowered)) {
            return true;
          }
          if (["false", "0", "no"].includes(lowered)) {
            return false;
          }
        }
        return value;
      case "array":
        if (!Array.isArray(value)) {
          return value;
        }
        return value.map((item) => this.castValue(item, schema.items));
      case "object":
        if (!this.isRecord(value)) {
          return value;
        }
        return this.castObject(value, schema);
    }
  }

  private validateValue(
    value: unknown,
    schema: JsonSchema,
    path: string,
  ): string[] {
    const label = path || "parameter";

    switch (schema.type) {
      case "string":
        if (typeof value !== "string") {
          return [`${label} should be string`];
        }

        return [
          ...this.validateEnum(value, schema.enum, label),
          ...this.validateStringBounds(value, schema, label),
        ];

      case "integer":
        if (typeof value !== "number" || !Number.isInteger(value)) {
          return [`${label} should be integer`];
        }

        return [
          ...this.validateEnum(value, schema.enum, label),
          ...this.validateNumberBounds(value, schema, label),
        ];

      case "number":
        if (typeof value !== "number" || Number.isNaN(value)) {
          return [`${label} should be number`];
        }

        return [
          ...this.validateEnum(value, schema.enum, label),
          ...this.validateNumberBounds(value, schema, label),
        ];

      case "boolean":
        if (typeof value !== "boolean") {
          return [`${label} should be boolean`];
        }

        return this.validateEnum(value, schema.enum, label);

      case "array":
        if (!Array.isArray(value)) {
          return [`${label} should be array`];
        }

        return value.flatMap((item, index) =>
          this.validateValue(
            item,
            schema.items,
            this.getChildPath(path, `[${index}]`),
          ),
        );

      case "object":
        if (!this.isRecord(value)) {
          return [`${label} should be object`];
        }

        return [
          ...this.validateRequired(value, schema, path),
          ...this.validateObjectProperties(value, schema, path),
        ];
    }
  }

  private validateEnum<T>(
    value: T,
    allowed: readonly T[] | undefined,
    label: string,
  ): string[] {
    if (allowed === undefined || allowed.includes(value)) {
      return [];
    }

    return [`${label} must be one of ${allowed.join(", ")}`];
  }

  private validateNumberBounds(
    value: number,
    schema: { minimum?: number; maximum?: number },
    label: string,
  ): string[] {
    const errors: string[] = [];

    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${label} must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${label} must be <= ${schema.maximum}`);
    }

    return errors;
  }

  private validateStringBounds(
    value: string,
    schema: { minLength?: number; maxLength?: number },
    label: string,
  ): string[] {
    const errors: string[] = [];

    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${label} must be at least ${schema.minLength} chars`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${label} must be at most ${schema.maxLength} chars`);
    }

    return errors;
  }

  private validateRequired(
    value: Record<string, unknown>,
    schema: ObjectSchema,
    path: string,
  ): string[] {
    return (schema.required ?? [])
      .filter((key) => !(key in value))
      .map((key) => `missing required ${this.getChildPath(path, key)}`);
  }

  private validateObjectProperties(
    value: Record<string, unknown>,
    schema: ObjectSchema,
    path: string,
  ): string[] {
    const properties = schema.properties ?? {};
    const errors: string[] = [];

    for (const [key, entry] of Object.entries(value)) {
      const propertySchema = properties[key];
      if (propertySchema !== undefined) {
        errors.push(
          ...this.validateValue(
            entry,
            propertySchema,
            this.getChildPath(path, key),
          ),
        );
      }
    }

    return errors;
  }

  private getChildPath(path: string, key: string): string {
    if (!path) {
      return key.startsWith("[") ? key : key;
    }

    return key.startsWith("[") ? `${path}${key}` : `${path}.${key}`;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private getValueType(value: unknown): string {
    if (value === null) {
      return "null";
    }
    if (Array.isArray(value)) {
      return "array";
    }

    return typeof value;
  }
}
