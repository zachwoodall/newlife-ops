const TITLES = new Set([
  "dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.",
  "pastor", "ps", "rev", "rev.", "reverend", "fr", "fr.",
  "elder", "bishop", "deacon",
]);

/**
 * The name to greet someone by. Skips an honorific so "Dr. Allan Malloy"
 * gives "Allan" rather than "Dr."
 */
export function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  for (const part of parts) {
    if (!TITLES.has(part.toLowerCase())) return part;
  }
  return parts[0] ?? fullName;
}
