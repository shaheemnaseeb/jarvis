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
