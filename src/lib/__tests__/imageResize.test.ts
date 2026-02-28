import { stripDataURIPrefix } from '../imageResize';

describe('stripDataURIPrefix', () => {
  it('strips JPEG data URI prefix', () => {
    const result = stripDataURIPrefix('data:image/jpeg;base64,abc123');
    expect(result).toBe('abc123');
  });

  it('strips PNG data URI prefix', () => {
    const result = stripDataURIPrefix('data:image/png;base64,xyz789');
    expect(result).toBe('xyz789');
  });

  it('strips WebP data URI prefix', () => {
    const result = stripDataURIPrefix('data:image/webp;base64,test');
    expect(result).toBe('test');
  });

  it('returns raw base64 unchanged', () => {
    const result = stripDataURIPrefix('abc123');
    expect(result).toBe('abc123');
  });
});
