import {
  isValidPan,
  isValidGstin,
  isValidIfsc,
  isValidPin,
  validateFormatFields,
} from '../services/format-validators';

describe('format validators', () => {
  describe('PAN', () => {
    it('accepts canonical PAN (5 letters + 4 digits + 1 letter)', () => {
      expect(isValidPan('ABCDE1234F')).toBe(true);
    });
    it('rejects malformed PAN', () => {
      expect(isValidPan('abcde1234f')).toBe(false); // lowercase
      expect(isValidPan('ABCDE12345')).toBe(false); // trailing digit
      expect(isValidPan('ABCD1234F')).toBe(false); // 4 leading letters
      expect(isValidPan('')).toBe(false);
    });
  });

  describe('GSTIN', () => {
    it('accepts canonical GSTIN (15 chars: state + PAN + entity + Z + check)', () => {
      // 27 (Maharashtra) + ABCDE1234F + 1 + Z + 5
      expect(isValidGstin('27ABCDE1234F1Z5')).toBe(true);
    });
    it('rejects malformed GSTIN', () => {
      expect(isValidGstin('27ABCDE1234F1A5')).toBe(false); // missing fixed Z
      expect(isValidGstin('27ABCDE1234F0Z5')).toBe(false); // entity digit cannot be 0
      expect(isValidGstin('27ABCDE1234F1Z')).toBe(false); // too short
      expect(isValidGstin('')).toBe(false);
    });
  });

  describe('IFSC', () => {
    it('accepts canonical IFSC (4 letters + 0 + 6 alphanumerics)', () => {
      expect(isValidIfsc('HDFC0001234')).toBe(true);
      expect(isValidIfsc('SBIN0ABC123')).toBe(true);
    });
    it('rejects malformed IFSC', () => {
      expect(isValidIfsc('HDFC1001234')).toBe(false); // 5th char must be 0
      expect(isValidIfsc('hdfc0001234')).toBe(false); // lowercase
      expect(isValidIfsc('HDFC00012345')).toBe(false); // too long
      expect(isValidIfsc('')).toBe(false);
    });
  });

  describe('PIN', () => {
    it('accepts canonical Indian PIN (6 digits, first non-zero)', () => {
      expect(isValidPin('400001')).toBe(true);
    });
    it('rejects malformed PIN', () => {
      expect(isValidPin('012345')).toBe(false); // leading zero
      expect(isValidPin('12345')).toBe(false); // 5 digits
      expect(isValidPin('1234567')).toBe(false); // 7 digits
      expect(isValidPin('40000A')).toBe(false); // non-digit
      expect(isValidPin('')).toBe(false);
    });
  });

  describe('validateFormatFields', () => {
    it('returns empty errors when all known fields are valid (or absent)', () => {
      expect(
        validateFormatFields({
          companyInfo: { panNumber: 'ABCDE1234F' },
          banking: { ifsc: 'HDFC0001234' },
          taxIds: { gstin: '27ABCDE1234F1Z5' },
          address: { pin: '400001' },
        }),
      ).toEqual({});
    });

    it('flags each invalid field with a stable error code', () => {
      const errors = validateFormatFields({
        companyInfo: { panNumber: 'bad' },
        banking: { ifsc: 'bad' },
        taxIds: { gstin: 'bad' },
        address: { pin: 'bad' },
      });
      expect(errors).toEqual({
        panNumber: 'invalid_pan',
        ifsc: 'invalid_ifsc',
        gstin: 'invalid_gstin',
        pin: 'invalid_pin',
      });
    });

    it('ignores absent values (drafts do not require all fields)', () => {
      expect(validateFormatFields({ companyInfo: {} })).toEqual({});
      expect(validateFormatFields({})).toEqual({});
    });
  });
});
