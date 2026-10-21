// French typography for displayed text: non-breaking spaces where a line must not break.

const NBSP = ' '

/** "n° 3", "« héroïque »", "Pourquoi ?" keep their parts on the same line. */
export function frenchSpacing(text: string): string {
  return text
    .replace(/([nN]°) /g, `$1${NBSP}`)
    .replace(/« /g, `«${NBSP}`)
    .replace(/ ([»;:!?])/g, `${NBSP}$1`)
}
