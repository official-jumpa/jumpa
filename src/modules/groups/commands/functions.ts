/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength?: number): string {
  if (!input) return "";

  // Remove potentially dangerous characters
  let sanitized = input
    .replace(/[<>]/g, "") // Remove < and > to prevent HTML injection
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .trim();

  // Truncate if maxLength is specified
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}
/**
 * Validate and sanitize group name
 */
export function validateAndSanitizeGroupName(name: string): {
  isValid: boolean;
  sanitized: string;
  errors: string[];
} {
  const errors: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push("Group name is required");
    return { isValid: false, sanitized: "", errors };
  }

  const sanitized = sanitizeString(name, 100);

  if (sanitized.length === 0) {
    errors.push("Group name contains only invalid characters");
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
  };
}


/**
 * Validate group creation parameters
 */
export function validateGroupCreation(params: {
  name: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate name
  if (!params.name || params.name.trim().length === 0) {
    errors.push("Group name is required");
  } else if (params.name.length > 15 || params.name.length < 3) {
    errors.push("Group name must be between 3 and 15 characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
