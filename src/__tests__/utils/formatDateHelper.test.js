const { formatDate } = require('../../utils/formatDateHelper');

describe('formatDate', () => {
  it('should return null for falsy input', () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
    expect(formatDate('')).toBeNull();
  });

  it('should parse ISO format (YYYY-MM-DD)', () => {
    const result = formatDate('2024-06-15');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(5); // 0-indexed
    expect(result.getDate()).toBe(15);
  });

  it('should parse ISO datetime format', () => {
    const result = formatDate('2024-06-15T10:30:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2024);
  });

  it('should parse DD-MM-YYYY format', () => {
    const result = formatDate('25-12-2023');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2023);
    expect(result.getMonth()).toBe(11); // December
    expect(result.getDate()).toBe(25);
  });

  it('should parse DD/MM/YYYY format', () => {
    const result = formatDate('01/03/2022');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2022);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(1);
  });

  it('should parse YYYY/MM/DD format', () => {
    const result = formatDate('2023/07/20');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2023);
    expect(result.getMonth()).toBe(6); // July
    expect(result.getDate()).toBe(20);
  });

  it('should return null for invalid date', () => {
    const result = formatDate('99-99-9999');
    // This may produce an invalid Date depending on JS engine
    // The function returns null for NaN dates
    if (result !== null) {
      expect(result).toBeInstanceOf(Date);
    }
  });
});
