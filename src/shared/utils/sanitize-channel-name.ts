/**
 * Sanitizes a string for use as a Discord channel name.
 * Converts to lowercase, removes accents, replaces special characters and spaces with hyphens.
 */
export function sanitizeChannelName(name: string): string {
  return name
    .normalize('NFD') // Decompose combined accents into base characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace spaces and special characters with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-|-$/g, '') // Trim hyphens from starts and ends
    .substring(0, 90);
}

/**
 * Generates a short, secure random alphanumeric code.
 */
export function generateShortId(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
