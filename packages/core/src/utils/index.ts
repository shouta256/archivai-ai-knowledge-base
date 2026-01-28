import { createHash } from 'crypto';

/**
 * Generate SHA256 hash of content for deduplication
 */
export function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generate SHA256 hash for device token
 */
export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map((byte) => chars[byte % chars.length])
    .join('');
}

/**
 * Generate 6-digit pair code
 */
export function generatePairCode(): string {
  const randomBytes = new Uint8Array(3);
  crypto.getRandomValues(randomBytes);
  const num = (randomBytes[0] << 16) | (randomBytes[1] << 8) | randomBytes[2];
  return String(num % 1000000).padStart(6, '0');
}

/**
 * Encode cursor for pagination
 */
export function encodeCursor(created_at: string, id: string): string {
  return Buffer.from(JSON.stringify({ created_at, id })).toString('base64url');
}

/**
 * Decode cursor for pagination
 */
export function decodeCursor(cursor: string): { created_at: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (typeof parsed.created_at === 'string' && typeof parsed.id === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get text content for embedding/classification
 */
export function getTextForProcessing(
  title: string | null,
  content_text: string | null,
  ink_caption: string | null
): string {
  const parts = [title, content_text, ink_caption].filter(Boolean);
  return parts.join('\n\n');
}

/**
 * Create snippet from text (first N characters)
 */
export function createSnippet(text: string | null, maxLength: number = 200): string | null {
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Get Monday of the week for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get Sunday of the week for a given date
 */
export function getWeekEnd(date: Date): Date {
  const monday = getWeekStart(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(attempts: number, maxMinutes: number = 60): number {
  const minutes = Math.min(Math.pow(2, attempts), maxMinutes);
  return minutes * 60 * 1000; // return milliseconds
}
