/**
 * Safe JSON parse with fallback — replaces scattered try/catch JSON.parse patterns.
 * @param {*} val - Value that may be a JSON string or already parsed
 * @param {*} fallback - Returned when parsing fails (default: [])
 * @returns {*} Parsed value or fallback
 */
const safeJsonParse = (val, fallback = []) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val !== "string") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

/**
 * Prefix a relative image path with BACKEND_URL if it isn't already an absolute URL.
 * @param {string} relativePath - e.g. "abc123.png"
 * @param {string} folder - URL path segment, e.g. "baby-image", "banners"
 * @returns {string} Full URL
 */
const formatImageUrl = (relativePath, folder) => {
  if (!relativePath) return relativePath;
  if (relativePath.startsWith("http")) return relativePath;
  return `${process.env.BACKEND_URL}/${folder}/${relativePath}`;
};

/**
 * Fisher-Yates shuffle — returns a new shuffled copy of the array.
 * @param {Array} array
 * @returns {Array}
 */
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Convert a snake_case or underscore-separated string to Title Case.
 * e.g. "product_type" => "Product Type"
 * @param {string} str
 * @returns {string}
 */
const snakeToTitleCase = (str) => {
  if (!str) return "";
  return str
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Split slash-separated color names and deduplicate by lowercased value.
 * Filters out numeric-only entries. Returns flat array of {id, name}.
 * @param {Array<{id: number, name: string}>} colorRows - Raw color rows from DB
 * @returns {Array<{id: number, name: string}>}
 */
const extractUniqueColors = (colorRows) => {
  const seen = new Set();
  const result = [];
  colorRows.forEach((item) => {
    const splitNames = item.name.includes("/")
      ? item.name.split("/")
      : [item.name];
    splitNames.forEach((name) => {
      const trimmedName = name.trim();
      if (!seen.has(trimmedName.toLowerCase()) && isNaN(trimmedName)) {
        seen.add(trimmedName.toLowerCase());
        result.push({ id: item.id, name: trimmedName });
      }
    });
  });
  return result;
};

module.exports = {
  safeJsonParse,
  formatImageUrl,
  shuffleArray,
  snakeToTitleCase,
  extractUniqueColors,
};
