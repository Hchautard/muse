import { describe, expect, it } from 'vitest'
import { frenchSpacing } from './typography'

describe('frenchSpacing', () => {
  it('ties numbers, quotes and high punctuation to their word', () => {
    expect(frenchSpacing('Symphonie n° 40')).toBe('Symphonie n° 40')
    expect(frenchSpacing('Polonaise « héroïque »')).toBe('Polonaise « héroïque »')
    expect(frenchSpacing('Une question ? Oui : deux ; trois !')).toBe(
      'Une question ? Oui : deux ; trois !',
    )
  })

  it('leaves other spaces alone', () => {
    expect(frenchSpacing('Le Lac des cygnes')).toBe('Le Lac des cygnes')
  })
})
