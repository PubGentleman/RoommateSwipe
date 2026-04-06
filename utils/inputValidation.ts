type ValidationRule = {
  maxLength?: number;
  pattern?: RegExp;
  required?: boolean;
  allowedValues?: string[];
};

type SchemaRules = Record<string, ValidationRule>;

export function validateAndSanitize<T extends Record<string, unknown>>(
  input: T,
  allowedFields: string[],
  rules?: SchemaRules
): Partial<T> {
  const sanitized: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in input && input[field] !== undefined) {
      let value = input[field];

      if (typeof value === 'string') {
        value = value.trim();
      }

      if (rules?.[field]) {
        const rule = rules[field];
        if (rule.required && (value === '' || value === null)) {
          throw new Error(`${field} is required`);
        }
        if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
          value = value.substring(0, rule.maxLength);
        }
        if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
          throw new Error(`${field} has invalid format`);
        }
        if (rule.allowedValues && !rule.allowedValues.includes(String(value))) {
          throw new Error(`${field} has invalid value`);
        }
      }

      sanitized[field] = value;
    }
  }

  return sanitized as Partial<T>;
}
