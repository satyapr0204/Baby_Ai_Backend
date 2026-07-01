const { getPagination, getPagingData } = require('../../utils/pagination');

describe('getPagination', () => {
  it('should return correct limit and offset for page 1', () => {
    const result = getPagination(1, 10);
    expect(result).toEqual({ limit: 10, offset: 0 });
  });

  it('should return correct offset for page 2', () => {
    const result = getPagination(2, 10);
    expect(result).toEqual({ limit: 10, offset: 10 });
  });

  it('should return correct offset for page 3 with size 5', () => {
    const result = getPagination(3, 5);
    expect(result).toEqual({ limit: 5, offset: 10 });
  });

  it('should default limit to 10 when size is falsy', () => {
    const result = getPagination(1, null);
    expect(result.limit).toBe(10);
  });

  it('should default offset to 0 when page is falsy', () => {
    const result = getPagination(null, 10);
    expect(result.offset).toBe(0);
  });

  it('should handle both undefined', () => {
    const result = getPagination(undefined, undefined);
    expect(result).toEqual({ limit: 10, offset: 0 });
  });
});

describe('getPagingData', () => {
  it('should format paging data correctly', () => {
    const data = {
      count: 50,
      rows: [{ id: 1 }, { id: 2 }],
    };
    const result = getPagingData(data, 1, 10);
    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.pagination).toEqual({
      current_page: 1,
      per_page: 10,
      total_items: 50,
      total_pages: 5,
    });
  });

  it('should calculate total_pages correctly with remainder', () => {
    const data = { count: 23, rows: [] };
    const result = getPagingData(data, 1, 10);
    expect(result.pagination.total_pages).toBe(3);
  });

  it('should default current_page to 1 when page is falsy', () => {
    const data = { count: 10, rows: [] };
    const result = getPagingData(data, null, 10);
    expect(result.pagination.current_page).toBe(1);
  });

  it('should handle zero count', () => {
    const data = { count: 0, rows: [] };
    const result = getPagingData(data, 1, 10);
    expect(result.pagination.total_items).toBe(0);
    expect(result.pagination.total_pages).toBe(0);
  });
});
