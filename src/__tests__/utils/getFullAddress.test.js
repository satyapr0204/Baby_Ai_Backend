const { formatFullAddress } = require('../../utils/getFullAddress');

describe('formatFullAddress', () => {
  it('should return "Address not found" for null input', () => {
    expect(formatFullAddress(null)).toBe('Address not found');
  });

  it('should return "Address not found" for undefined input', () => {
    expect(formatFullAddress(undefined)).toBe('Address not found');
  });

  it('should format a full address with all fields', () => {
    const data = {
      address_type: 'Home',
      street_address: '123 Main St',
      apartment: 'Apt 4B',
      city: 'New York',
      state: 'NY',
      country_id: 'US',
      post_code: '10001',
    };
    const result = formatFullAddress(data);
    expect(result).toBe('[Home] 123 Main St, Apt 4B, New York, NY, US - 10001');
  });

  it('should format address without address_type', () => {
    const data = {
      street_address: '456 Elm St',
      apartment: '',
      city: 'Boston',
      state: 'MA',
      country_id: 'US',
      post_code: '02101',
    };
    const result = formatFullAddress(data);
    expect(result).toBe('456 Elm St, Boston, MA, US - 02101');
  });

  it('should skip null and "null" string values', () => {
    const data = {
      street_address: '789 Oak Ave',
      apartment: 'null',
      city: 'Chicago',
      state: null,
      country_id: 'US',
      post_code: null,
    };
    const result = formatFullAddress(data);
    expect(result).toBe('789 Oak Ave, Chicago, US');
  });

  it('should skip empty string values', () => {
    const data = {
      street_address: '100 Pine St',
      apartment: '',
      city: '',
      state: 'CA',
      country_id: '',
      post_code: '90210',
    };
    const result = formatFullAddress(data);
    expect(result).toBe('100 Pine St, CA - 90210');
  });

  it('should handle address with only post_code as "null"', () => {
    const data = {
      street_address: '1 First Ave',
      city: 'LA',
      state: 'CA',
      country_id: 'US',
      post_code: 'null',
    };
    const result = formatFullAddress(data);
    expect(result).toBe('1 First Ave, LA, CA, US');
  });

  it('should handle completely empty address data', () => {
    const data = {};
    const result = formatFullAddress(data);
    expect(result).toBe('');
  });
});
