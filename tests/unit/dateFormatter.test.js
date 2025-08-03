const { formatDate } = require('../../src/utils/dateFormatter');

describe('formatDate', () => {
  // Test case 1: French format by default
  test('should format a valid date string into French format by default', () => {
    const dateString = '2023-01-15';
    // On some systems, the default locale might not be French.
    // To make the test reliable, we temporarily set the locale for this test.
    const originalLang = process.env.SITE_LANGUAGE;
    process.env.SITE_LANGUAGE = 'fr';
    expect(formatDate(dateString)).toBe('15 janvier 2023');
    process.env.SITE_LANGUAGE = originalLang;
  });

  // Test case 2: English format when SITE_LANGUAGE is set to 'en'
  test('should format a valid date string into English format when SITE_LANGUAGE is set to \'en\'', () => {
    const dateString = '2023-01-15';
    const originalLang = process.env.SITE_LANGUAGE;
    process.env.SITE_LANGUAGE = 'en';
    expect(formatDate(dateString)).toBe('January 15, 2023');
    process.env.SITE_LANGUAGE = originalLang;
  });

  // Test case 3: Null input
  test('should return null when the input is null', () => {
    expect(formatDate(null)).toBeNull();
  });

  // Test case 4: Undefined input
  test('should return null when the input is undefined', () => {
    expect(formatDate(undefined)).toBeNull();
  });

  // Test case 5: Empty string input
  test('should return null when the input is an empty string', () => {
    expect(formatDate('')).toBeNull();
  });

  test('should throw a RangeError for an invalid date string', () => {
    const dateString = 'not a real date';
    expect(() => formatDate(dateString)).toThrow(RangeError);
  });
});
