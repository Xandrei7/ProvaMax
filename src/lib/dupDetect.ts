/**
 * Computes a fingerprint for duplicate-question detection.
 * Ignores HTML, leading metadata (banca/órgão/ano at the start of statement),
 * and normalizes whitespace/casing.
 */
function cleanText(s: string): string {
  return s
    .replace(/<[^>]+>/g, '') // strip HTML tags
    .replace(/\s+/g, ' ')
    .trim()
}

export function dupFingerprint(
  statement: string,
  options?: { letter: string; text: string }[] | null,
): string {
  let core = cleanText(statement)
  // Strip leading "(BANCA – YEAR – ORG)" or "[BANCA – YEAR]" prefix
  core = core.replace(/^\s*\([^)]{0,150}\)\s*/, '')
  core = core.replace(/^\s*\[[^\]]{0,150}\]\s*/, '')
  // Strip leading metadata tokens separated by – or - or /
  // e.g. "CESPE – 2021 – TCU –" or "FCC/2020/TJSP -"
  core = core.replace(/^(?:[\w/áéíóúâêîôûãõàèìòùÀ-Ú.]+\s*[-–/]\s*){2,}/i, '').trim()
  core = core.toLowerCase()
  const opts = (options ?? [])
    .map(o => cleanText(o.text).toLowerCase())
    .join('\x00')
  return core + '\x01' + opts
}
