export class Tool {
    castParams(params) {
        return this.castObject(params, this.parameters);
    }
    validateParams(params) {
        if (!this.isRecord(params)) {
            return [`parameters must be an object, got ${this.getValueType(params)}`];
        }
        return this.validateValue(params, this.parameters, "");
    }
    toSchema() {
        return {
            type: "function",
            function: {
                name: this.name,
                description: this.description,
                parameters: this.parameters,
            },
        };
    }
    castObject(value, schema) {
        const properties = schema.properties ?? {};
        const result = {};
        for (const [key, entry] of Object.entries(value)) {
            const propertySchema = properties[key];
            result[key] =
                propertySchema === undefined
                    ? entry
                    : this.castValue(entry, propertySchema);
        }
        return result;
    }
    castValue(value, schema) {
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
    validateValue(value, schema, path) {
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
                return value.flatMap((item, index) => this.validateValue(item, schema.items, this.getChildPath(path, `[${index}]`)));
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
    validateEnum(value, allowed, label) {
        if (allowed === undefined || allowed.includes(value)) {
            return [];
        }
        return [`${label} must be one of ${allowed.join(", ")}`];
    }
    validateNumberBounds(value, schema, label) {
        const errors = [];
        if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push(`${label} must be >= ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push(`${label} must be <= ${schema.maximum}`);
        }
        return errors;
    }
    validateStringBounds(value, schema, label) {
        const errors = [];
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push(`${label} must be at least ${schema.minLength} chars`);
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            errors.push(`${label} must be at most ${schema.maxLength} chars`);
        }
        return errors;
    }
    validateRequired(value, schema, path) {
        return (schema.required ?? [])
            .filter((key) => !(key in value))
            .map((key) => `missing required ${this.getChildPath(path, key)}`);
    }
    validateObjectProperties(value, schema, path) {
        const properties = schema.properties ?? {};
        const errors = [];
        for (const [key, entry] of Object.entries(value)) {
            const propertySchema = properties[key];
            if (propertySchema !== undefined) {
                errors.push(...this.validateValue(entry, propertySchema, this.getChildPath(path, key)));
            }
        }
        return errors;
    }
    getChildPath(path, key) {
        if (!path) {
            return key.startsWith("[") ? key : key;
        }
        return key.startsWith("[") ? `${path}${key}` : `${path}.${key}`;
    }
    isRecord(value) {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    getValueType(value) {
        if (value === null) {
            return "null";
        }
        if (Array.isArray(value)) {
            return "array";
        }
        return typeof value;
    }
}
//# sourceMappingURL=base.js.map