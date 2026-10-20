import { describe, expect, it } from 'vitest'
import { isAllowedLicense, normalizeLicense } from './licenses'

describe('normalizeLicense', () => {
  it.each([
    ['Public domain', 'Public domain'],
    ['Public Domain', 'Public domain'],
    ['PD-old-70', 'Public domain'],
    ['CC0', 'CC0'],
    ['CC0 1.0', 'CC0'],
    ['CC BY 3.0', 'CC BY 3.0'],
    ['CC-BY-4.0', 'CC BY 4.0'],
    ['CC BY-SA 2.0', 'CC BY-SA 2.0'],
    ['cc-by-sa-4.0', 'CC BY-SA 4.0'],
    ['CC BY-SA 3.0 de', 'CC BY-SA 3.0 de'],
    ['CC BY-SA 2.0 DE', 'CC BY-SA 2.0 de'],
  ])('accepts %s', (raw, expected) => {
    expect(normalizeLicense(raw)).toBe(expected)
  })

  it.each([
    'CC BY-NC 4.0',
    'CC BY-NC-SA 3.0',
    'CC BY-ND 2.0',
    'GFDL',
    'EEF OAL-1',
    'Attribution',
    '',
  ])('rejects %s', (raw) => {
    expect(normalizeLicense(raw)).toBeNull()
  })
})

describe('isAllowedLicense', () => {
  it('only accepts normalized names', () => {
    expect(isAllowedLicense('CC BY-SA 4.0')).toBe(true)
    expect(isAllowedLicense('Public domain')).toBe(true)
    expect(isAllowedLicense('cc-by-sa-4.0')).toBe(false)
    expect(isAllowedLicense('CC BY-NC 4.0')).toBe(false)
  })
})
