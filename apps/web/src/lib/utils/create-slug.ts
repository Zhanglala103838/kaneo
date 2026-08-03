export function createSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      // Keep letters and digits from any script. A bare `\w` is ASCII-only, so
      // names written in Chinese, Cyrillic, Greek or Korean were stripped down
      // to an empty slug — which the server rejects as too short.
      .replace(/[^\p{L}\p{N}\s_-]/gu, "") // Remove special characters
      .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, "")
  ); // Remove leading/trailing hyphens
}
