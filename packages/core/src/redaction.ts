const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /sk-proj-[A-Za-z0-9_-]{20,}/,
  /api[_-]?key\s*[:=]\s*[A-Za-z0-9_-]{16,}/i,
  /token\s*[:=]\s*[A-Za-z0-9_-]{16,}/i,
  /password\s*[:=]\s*\S{8,}/i
];

export function containsSecretLikeContent(value: unknown): boolean {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}
