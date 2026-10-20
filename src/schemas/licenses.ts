// Licenses accepted for media: public domain, CC0, CC BY and CC BY-SA (any version, ported or not).
// Stored in normalized form, e.g. "Public domain", "CC0", "CC BY 3.0", "CC BY-SA 2.0 de".
const ALLOWED_LICENSE = /^(Public domain|CC0|CC BY(-SA)? \d\.\d( [a-z]{2,3})?)$/

export function isAllowedLicense(license: string): boolean {
  return ALLOWED_LICENSE.test(license)
}

/**
 * Maps a free-form license name (e.g. Commons' LicenseShortName) to its normalized form,
 * or returns null when the license is not on the allowed list (NC, ND, GFDL, unknown…).
 */
export function normalizeLicense(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, ' ')
  if (/^(public domain|pd(-[\w-]+)?)$/i.test(value)) return 'Public domain'
  if (/^cc[ -]?0( 1\.0)?( universal)?$/i.test(value) || /^cc[ -]zero$/i.test(value)) return 'CC0'

  const cc = /^cc[ -]by(-sa)?[ -](\d\.\d)(?:[ -]([a-z]{2,3}))?$/i.exec(value)
  if (cc) {
    const [, sa, version, port] = cc
    return `CC BY${sa ? '-SA' : ''} ${version}${port ? ` ${port.toLowerCase()}` : ''}`
  }
  return null
}

/** French label for display: "Domaine public", otherwise the license name itself. */
export function licenseLabel(license: string): string {
  return license === 'Public domain' ? 'Domaine public' : license
}
