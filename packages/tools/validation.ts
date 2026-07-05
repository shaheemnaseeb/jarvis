export function requireEnumField<T extends string>(
  raw: unknown,
  field: string,
  allowed: readonly T[],
  tool: string,
): T {
  const value = requireStringField(raw, field, tool);

  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(
      `${tool}: '${field}' must be one of ${allowed.join(", ")}, got '${value}'`,
    );
  }

  return value as T;
}

export function requireStringField(
  raw: unknown,
  field: string,
  tool: string,
): string {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${tool}: expected an args object, got ${typeof raw}`);
  }

  const value = (raw as Record<string, unknown>)[field];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${tool}: missing or empty '${field}' argument`);
  }

  return value;
}
