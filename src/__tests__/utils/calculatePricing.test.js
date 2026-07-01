const { calculateSafeMargin } = require('../../utils/calculatePricing');

describe('calculateSafeMargin', () => {
  it('should return error for zero cost', () => {
    const result = calculateSafeMargin(0, 10, 5);
    expect(result.error).toBe('Invalid Cost');
    expect(result.sellingPrice).toBe(0);
    expect(result.marginAmt).toBe(0);
    expect(result.marginPct).toBe(0);
  });

  it('should return error for negative cost', () => {
    const result = calculateSafeMargin(-10, 10, 5);
    expect(result.error).toBe('Invalid Cost');
  });

  it('should return error for non-numeric cost', () => {
    const result = calculateSafeMargin('abc', 10, 5);
    expect(result.error).toBe('Invalid Cost');
  });

  it('should calculate correctly with addon and discount', () => {
    const result = calculateSafeMargin(100, 20, 10);
    // cost=100, addon=20% => marked=120, discount=10% => selling=108
    expect(result.originalCost).toBe('100.00');
    expect(result.markedPrice).toBe('120.00');
    expect(result.sellingPrice).toBe('108.00');
    expect(result.marginAmt).toBe('8.00');
    expect(result.status).toBe('Profit');
  });

  it('should calculate with zero addon and zero discount', () => {
    const result = calculateSafeMargin(50, 0, 0);
    // No addon, no discount => selling = cost
    expect(result.originalCost).toBe('50.00');
    expect(result.markedPrice).toBe('50.00');
    expect(result.sellingPrice).toBe('50.00');
    expect(result.marginAmt).toBe('0.00');
    expect(result.status).toBe('Break-Even (No Profit No Loss)');
  });

  it('should detect loss when discount exceeds addon', () => {
    const result = calculateSafeMargin(100, 5, 50);
    // cost=100, addon=5% => marked=105, discount=50% => selling=52.50
    expect(result.sellingPrice).toBe('52.50');
    expect(parseFloat(result.marginAmt)).toBeLessThan(0);
    expect(result.status).toBe('Loss');
  });

  it('should handle string cost input', () => {
    const result = calculateSafeMargin('200', 10, 5);
    expect(result.originalCost).toBe('200.00');
    expect(result.markedPrice).toBe('220.00');
    // selling = 220 - (220 * 0.05) = 220 - 11 = 209
    expect(result.sellingPrice).toBe('209.00');
    expect(result.status).toBe('Profit');
  });

  it('should calculate margin percentage correctly', () => {
    const result = calculateSafeMargin(100, 50, 0);
    // marked = 150, selling = 150, margin = 50
    // marginPct = (50/150)*100 = 33.33
    expect(result.marginPct).toBe('33.33');
  });

  it('should handle 100% discount (break-even at zero selling)', () => {
    const result = calculateSafeMargin(100, 0, 100);
    // marked = 100, selling = 0, margin = -100
    expect(result.sellingPrice).toBe('0.00');
    expect(result.status).toBe('Loss');
  });
});
