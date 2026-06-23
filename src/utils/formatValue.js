/**
 * Splits slash-separated names into arrays and optionally adds hex codes for colors.
 * @param {object} obj - Object with a `name` property (e.g. fabric, color, size, brand)
 * @param {boolean} isColor - When true, appends `hashcode` array with hex values
 * @returns {object} The object with `name` as an array of trimmed strings
 */
const formatValue = (obj, isColor = false) => {
  if (!obj || !obj.name) return obj;
  if (Array.isArray(obj.name)) return obj;

  let formattedNames;
  if (obj.name.includes("/")) {
    formattedNames = obj.name
      .split("/")
      .map((item) => item.trim())
      .filter(Boolean);
  } else {
    formattedNames = [obj.name.trim()];
  }

  const result = {
    ...obj,
    name: formattedNames,
  };

  if (isColor) {
    result.hashcode = formattedNames.map((name) => getColorHex(name));
  }

  return result;
};

const COLOR_HEX_MAP = {
  black: "#000000",
  blue: "#0000FF",
  grey: "#808080",
  "heather grey": "#808080",
  navy: "#000080",
  red: "#FF0000",
  white: "#FFFFFF",
  pink: "#FFC0CB",
  yellow: "#FFFF00",
  green: "#008000",
  mint: "#98FF98",
  aqua: "#00FFFF",
  cream: "#FFFDD0",
  print: "#E0E0E0",
  prints: "#E0E0E0",
};

const getColorHex = (dbColorName) => {
  const primaryColor = dbColorName.toLowerCase().split("/")[0].trim();
  if (primaryColor.includes("print")) return COLOR_HEX_MAP["print"];
  return COLOR_HEX_MAP[primaryColor] || "#D3D3D3";
};

module.exports = { formatValue, getColorHex };
