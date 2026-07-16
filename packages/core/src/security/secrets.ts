/** Patterns with one capture group = full secret; two groups = prefix + secret. */
const SECRET_PATTERNS: Array<{ re: RegExp; kind: 'full' | 'prefixed' }> = [
  { re: /sk-[a-zA-Z0-9]{16,}/g, kind: 'full' },
  { re: /AKIA[0-9A-Z]{16}/g, kind: 'full' },
  { re: /ghp_[a-zA-Z0-9]{20,}/g, kind: 'full' },
  { re: /gho_[a-zA-Z0-9]{20,}/g, kind: 'full' },
  { re: /xox[baprs]-[a-zA-Z0-9-]{10,}/g, kind: 'full' },
  { re: /\b(api[_-]?key\s*[:=]\s*["']?)([a-zA-Z0-9_\-./+=]{8,})/gi, kind: 'prefixed' },
  { re: /\b(password\s*[:=]\s*["']?)([^\s"']{4,})/gi, kind: 'prefixed' },
  { re: /\b(token\s*[:=]\s*["']?)([a-zA-Z0-9_\-./+=]{8,})/gi, kind: 'prefixed' },
  { re: /\b(Bearer\s+)([a-zA-Z0-9_\-./+=]{8,})/gi, kind: 'prefixed' },
  { re: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, kind: 'full' },
];

export function redactSecrets(input: string): string {
  let result = input;
  for (const { re, kind } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    if (kind === 'full') {
      result = result.replace(re, '[REDACTED]');
    } else {
      result = result.replace(re, (_match, prefix: string) => `${prefix}[REDACTED]`);
    }
  }
  return result;
}

export function containsSecret(input: string): boolean {
  for (const { re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(input)) return true;
  }
  return false;
}

export function maskValue(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars * 2) return '[REDACTED]';
  return `${value.slice(0, visibleChars)}…${value.slice(-visibleChars)}`;
}
