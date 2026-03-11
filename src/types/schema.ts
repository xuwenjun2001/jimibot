export type JsonSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object";

interface BaseSchema {
  description?: string;
}

export interface StringSchema extends BaseSchema {
  type: "string";
  enum?: string[];
  minLength?: number;
  maxLength?: number;
}

export interface NumberSchema extends BaseSchema {
  type: "number";
  enum?: number[];
  minimum?: number;
  maximum?: number;
}

export interface IntegerSchema extends BaseSchema {
  type: "integer";
  enum?: number[];
  minimum?: number;
  maximum?: number;
}

export interface BooleanSchema extends BaseSchema {
  type: "boolean";
  enum?: boolean[];
}

export interface ArraySchema extends BaseSchema {
  type: "array";
  items: JsonSchema;
}

export interface ObjectSchema extends BaseSchema {
  type: "object";
  properties?: Record<string, JsonSchema>;
  required?: string[];
}

export interface ToolParametersSchema extends ObjectSchema {
  type: "object";
  properties: Record<string, JsonSchema>;
}

export type JsonSchema =
  | StringSchema
  | NumberSchema
  | IntegerSchema
  | BooleanSchema
  | ArraySchema
  | ObjectSchema;
