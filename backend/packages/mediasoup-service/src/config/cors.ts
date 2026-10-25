export function parseAllowedOrigins(rawOrigins: string): string[] {
  return [...new Set(rawOrigins.split(',').map((origin) => origin.trim()).filter(Boolean))];
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[]
): boolean {
  return origin === undefined || allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}
