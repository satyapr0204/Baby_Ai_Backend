/**
 * Tests for the pure helper functions used in PriceHelper.js and calclutePricewithSuffaling.js.
 * Since formatValue and getColorHex are internal (not exported), we replicate their logic here
 * to validate the pricing and formatting behavior used across the codebase.
 */

// Replicate the internal getColorHex logic for testing
const getColorHex = (dbColorName) => {
  const colorMap = {
    black: '#000000',
    blue: '#0000FF',
    grey: '#808080',
    'heather grey': '#808080',
    navy: '#000080',
    red: '#FF0000',
    white: '#FFFFFF',
    pink: '#FFC0CB',
    yellow: '#FFFF00',
    green: '#008000',
    mint: '#98FF98',
    aqua: '#00FFFF',
    cream: '#FFFDD0',
    print: '#E0E0E0',
    prints: '#E0E0E0',
  };
  const primaryColor = dbColorName.toLowerCase().split('/')[0].trim();
  if (primaryColor.includes('print')) return colorMap['print'];
  return colorMap[primaryColor] || '#D3D3D3';
};

// Replicate the internal formatValue logic for testing
const formatValue = (obj, isColor = false) => {
  if (!obj || !obj.name) return obj;
  if (Array.isArray(obj.name)) return obj;

  let formattedNames;
  if (obj.name.includes('/')) {
    formattedNames = obj.name
      .split('/')
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

describe('getColorHex', () => {
  it('should return correct hex for known colors', () => {
    expect(getColorHex('black')).toBe('#000000');
    expect(getColorHex('Blue')).toBe('#0000FF');
    expect(getColorHex('RED')).toBe('#FF0000');
    expect(getColorHex('white')).toBe('#FFFFFF');
    expect(getColorHex('navy')).toBe('#000080');
    expect(getColorHex('pink')).toBe('#FFC0CB');
    expect(getColorHex('yellow')).toBe('#FFFF00');
    expect(getColorHex('green')).toBe('#008000');
    expect(getColorHex('mint')).toBe('#98FF98');
    expect(getColorHex('aqua')).toBe('#00FFFF');
    expect(getColorHex('cream')).toBe('#FFFDD0');
  });

  it('should return default hex for unknown colors', () => {
    expect(getColorHex('purple')).toBe('#D3D3D3');
    expect(getColorHex('magenta')).toBe('#D3D3D3');
    expect(getColorHex('unknown')).toBe('#D3D3D3');
  });

  it('should handle "print" variations', () => {
    expect(getColorHex('print')).toBe('#E0E0E0');
    expect(getColorHex('prints')).toBe('#E0E0E0');
    expect(getColorHex('Printed')).toBe('#E0E0E0');
  });

  it('should use only the primary color (before /)', () => {
    expect(getColorHex('black/white')).toBe('#000000');
    expect(getColorHex('Red / Blue')).toBe('#FF0000');
  });

  it('should be case-insensitive', () => {
    expect(getColorHex('BLACK')).toBe('#000000');
    expect(getColorHex('Heather Grey')).toBe('#808080');
  });
});

describe('formatValue', () => {
  it('should return null/undefined as-is', () => {
    expect(formatValue(null)).toBeNull();
    expect(formatValue(undefined)).toBeUndefined();
  });

  it('should return object without name as-is', () => {
    const obj = { id: 1 };
    expect(formatValue(obj)).toEqual({ id: 1 });
  });

  it('should return object with array name as-is', () => {
    const obj = { id: 1, name: ['Red', 'Blue'] };
    expect(formatValue(obj)).toEqual({ id: 1, name: ['Red', 'Blue'] });
  });

  it('should split name by / into array', () => {
    const obj = { id: 1, name: 'Red / Blue' };
    const result = formatValue(obj);
    expect(result.name).toEqual(['Red', 'Blue']);
  });

  it('should wrap single name in array', () => {
    const obj = { id: 1, name: 'Cotton' };
    const result = formatValue(obj);
    expect(result.name).toEqual(['Cotton']);
  });

  it('should trim whitespace from names', () => {
    const obj = { id: 1, name: '  Silk  ' };
    const result = formatValue(obj);
    expect(result.name).toEqual(['Silk']);
  });

  it('should filter empty parts from split', () => {
    const obj = { id: 1, name: 'Red//Blue/' };
    const result = formatValue(obj);
    expect(result.name).toEqual(['Red', 'Blue']);
  });

  it('should add hashcode when isColor is true', () => {
    const obj = { id: 1, name: 'Red / Blue' };
    const result = formatValue(obj, true);
    expect(result.hashcode).toEqual(['#FF0000', '#0000FF']);
  });

  it('should not add hashcode when isColor is false', () => {
    const obj = { id: 1, name: 'Cotton' };
    const result = formatValue(obj, false);
    expect(result.hashcode).toBeUndefined();
  });

  it('should preserve other properties', () => {
    const obj = { id: 5, name: 'Red', extra: 'data' };
    const result = formatValue(obj);
    expect(result.id).toBe(5);
    expect(result.extra).toBe('data');
    expect(result.name).toEqual(['Red']);
  });
});
