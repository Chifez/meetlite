/**
 * Utility functions for handling tags - Fixed version
 */

/**
 * Check if a recording has valid tags
 */
export const hasValidTags = (tags?: string[]): boolean => {
  if (!tags || !Array.isArray(tags)) return false;

  // Filter out any falsy values, empty strings, or strings with only whitespace
  const validTags = tags.filter(
    (tag) => tag && typeof tag === 'string' && tag.trim() !== '' && tag !== '[]' // Explicitly filter out the string "[]"
  );

  return validTags.length > 0;
};

/**
 * Get filtered tags (remove empty/null/undefined tags)
 */
export const getValidTags = (tags?: string[]): string[] => {
  if (!tags || !Array.isArray(tags)) return [];

  // Filter out any falsy values, empty strings, or strings with only whitespace
  return tags
    .filter(
      (tag) =>
        tag && typeof tag === 'string' && tag.trim() !== '' && tag !== '[]' // Explicitly filter out the string "[]"
    )
    .map((tag) => tag.trim()); // Also trim whitespace from valid tags
};
