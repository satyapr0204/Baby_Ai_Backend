const { paginateArray } = require('../../utils/paginateArray');

describe('paginateArray', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

  it('should return first page with default size', () => {
    const result = paginateArray(items, 1, 10);
    expect(result.paginatedItems).toHaveLength(10);
    expect(result.paginatedItems[0].id).toBe(1);
    expect(result.pagination.total_items).toBe(25);
    expect(result.pagination.total_pages).toBe(3);
    expect(result.pagination.current_page).toBe(1);
    expect(result.pagination.per_page).toBe(10);
  });

  it('should return second page', () => {
    const result = paginateArray(items, 2, 10);
    expect(result.paginatedItems).toHaveLength(10);
    expect(result.paginatedItems[0].id).toBe(11);
  });

  it('should return last partial page', () => {
    const result = paginateArray(items, 3, 10);
    expect(result.paginatedItems).toHaveLength(5);
    expect(result.paginatedItems[0].id).toBe(21);
  });

  it('should return empty array for out-of-range page', () => {
    const result = paginateArray(items, 10, 10);
    expect(result.paginatedItems).toHaveLength(0);
  });

  it('should default to page 1 when page is falsy', () => {
    const result = paginateArray(items, null, 5);
    expect(result.pagination.current_page).toBe(1);
    expect(result.paginatedItems).toHaveLength(5);
    expect(result.paginatedItems[0].id).toBe(1);
  });

  it('should default to size 10 when size is falsy', () => {
    const result = paginateArray(items, 1, null);
    expect(result.pagination.per_page).toBe(10);
    expect(result.paginatedItems).toHaveLength(10);
  });

  it('should handle empty array', () => {
    const result = paginateArray([], 1, 10);
    expect(result.paginatedItems).toHaveLength(0);
    expect(result.pagination.total_items).toBe(0);
    expect(result.pagination.total_pages).toBe(0);
  });

  it('should handle string page and size values', () => {
    const result = paginateArray(items, '2', '5');
    expect(result.pagination.current_page).toBe(2);
    expect(result.pagination.per_page).toBe(5);
    expect(result.paginatedItems).toHaveLength(5);
    expect(result.paginatedItems[0].id).toBe(6);
  });
});
