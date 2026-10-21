import { describe, expect, it } from 'vitest'
import { aicImage, metImage, parseMuseumRef, type AicArtwork, type MetObject } from './museums'

const aic: AicArtwork = {
  data: {
    id: 16568,
    title: 'Water Lilies',
    artist_title: 'Claude Monet',
    is_public_domain: true,
    image_id: '3c27b499-af56-f0d5-93b5-a7f2f1ad5813',
  },
  config: { iiif_url: 'https://www.artic.edu/iiif/2', website_url: 'https://www.artic.edu' },
}

const met: MetObject = {
  objectID: 435844,
  title: 'The Musicians',
  artistDisplayName: 'Caravaggio (Michelangelo Merisi)',
  isPublicDomain: true,
  primaryImage: 'https://images.metmuseum.org/CRDImages/ep/original/DP-687-001.jpg',
  objectURL: 'https://www.metmuseum.org/art/collection/search/435844',
}

describe('museum images', () => {
  it('reads museum references', () => {
    expect(parseMuseumRef('aic:16568')).toEqual({ museum: 'aic', objectId: 16568 })
    expect(parseMuseumRef('met:435844')).toEqual({ museum: 'met', objectId: 435844 })
    expect(parseMuseumRef('File:Monet.jpg')).toBeNull()
    expect(parseMuseumRef('louvre:12')).toBeNull()
  })

  it('takes public domain images under CC0, with the museum as credit', () => {
    expect(aicImage(aic)).toEqual({
      url: 'https://www.artic.edu/iiif/2/3c27b499-af56-f0d5-93b5-a7f2f1ad5813/full/1686,/0/default.jpg',
      headers: { 'AIC-User-Agent': 'MuseLearningApp (personal learning PWA)' },
      credit: 'Art Institute of Chicago',
      license: 'CC0',
      sourceUrl: 'https://www.artic.edu/artworks/16568',
      title: 'Water Lilies',
      artist: 'Claude Monet',
    })
    expect(metImage(met)).toMatchObject({
      url: met.primaryImage,
      credit: 'The Metropolitan Museum of Art',
      license: 'CC0',
      sourceUrl: met.objectURL,
    })
  })

  it('refuses works the museum does not place in the public domain', () => {
    expect(() => aicImage({ ...aic, data: { ...aic.data, is_public_domain: false } })).toThrow(
      'domaine public',
    )
    expect(() => metImage({ ...met, isPublicDomain: false, primaryImage: '' })).toThrow(
      'domaine public',
    )
  })
})
