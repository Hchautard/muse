// A small but complete course bundle for tests.
import type { CourseBundle } from '../../src/schemas/content'

export function makeBundle(): CourseBundle {
  return {
    id: 'music',
    title: 'Musique classique',
    version: 'test',
    units: [
      {
        id: 'u1',
        title: 'Repères',
        description: 'Test',
        lessons: [
          {
            id: 'l1',
            title: 'Bach',
            introduces: ['baroque', 'bach', 'toccata'],
            skills: ['audio-to-composer', 'audio-to-period', 'work-to-date'],
          },
        ],
      },
    ],
    entities: [
      {
        id: 'baroque',
        type: 'period',
        name: 'Baroque',
        yearStart: 1600,
        yearEnd: 1750,
        summary: 'Période.',
        mediaIds: [],
      },
      {
        id: 'bach',
        type: 'person',
        name: 'Bach',
        yearStart: 1685,
        yearEnd: 1750,
        summary: 'Compositeur.',
        mediaIds: ['bach-image'],
      },
      {
        id: 'toccata',
        type: 'work',
        name: 'Toccata',
        year: 1704,
        summary: 'Œuvre.',
        mediaIds: ['toccata-audio'],
      },
    ],
    relations: [
      { from: 'toccata', type: 'createdBy', to: 'bach' },
      { from: 'toccata', type: 'inPeriod', to: 'baroque' },
      { from: 'bach', type: 'inPeriod', to: 'baroque' },
    ],
    media: [
      {
        id: 'bach-image',
        kind: 'image',
        src: 'music/images/bach-image-960.webp',
        bytes: 1000,
        width: 960,
        height: 1200,
        variants: [{ width: 960, src: 'music/images/bach-image-960.webp', bytes: 1000 }],
        credit: 'Elias Gottlob Haussmann',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bach.png',
      },
      {
        id: 'toccata-audio',
        kind: 'audio',
        src: 'music/audio/toccata-audio.m4a',
        bytes: 2000,
        durationSec: 20,
        credit: 'Interprète',
        license: 'CC BY-SA 4.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Toccata.ogg',
      },
    ],
  }
}
