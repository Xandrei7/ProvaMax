const BLOCK_TAGS = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'td', 'thead', 'tbody']

function decodeHtmlEntities(input: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = input
  return textarea.value
}

function decodeIfNeeded(input: string): string {
  if (!/&(?:lt|gt|amp|quot|#39|apos);/i.test(input)) return input

  let decoded = input
  for (let i = 0; i < 2; i++) {
    const next = decodeHtmlEntities(decoded)
    if (next === decoded) break
    decoded = next
  }
  return decoded
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isRealColor(color: string): boolean {
  if (!color) return false
  const normalized = color.replace(/\s/g, '').toLowerCase()
  return !(
    normalized === '' ||
    normalized === 'rgb(0,0,0)' ||
    normalized === 'rgba(0,0,0,1)' ||
    normalized === '#000000' ||
    normalized === '#000' ||
    normalized === 'black' ||
    normalized === 'windowtext' ||
    normalized === 'inherit' ||
    normalized === 'initial' ||
    normalized === 'unset' ||
    normalized === 'currentcolor'
  )
}

function sanitizeColorValue(color: string): string | null {
  const value = color.trim()
  if (!isRealColor(value)) return null

  const isHex = /^#([\da-f]{3}|[\da-f]{6})$/i.test(value)
  const isRgb = /^rgba?\([\d\s.,%]+\)$/i.test(value)
  const isHsl = /^hsla?\([\d\s.,%]+\)$/i.test(value)
  const isNamed = /^[a-z]+$/i.test(value)

  if (!isHex && !isRgb && !isHsl && !isNamed) return null
  return value
}

export function sanitizeRichTextForRender(html: string | null | undefined, preserveColor = false): string {
  if (!html) return ''

  const decoded = decodeIfNeeded(html)
  const parser = new DOMParser()
  const doc = parser.parseFromString(decoded, 'text/html')

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent ?? '')
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    if (tag === 'br') return '\n'
    if (['head', 'style', 'script', 'meta', 'link', 'iframe', 'object', 'embed'].includes(tag)) return ''

    const inner = Array.from(el.childNodes).map(walk).join('')
    const style = el.style

    const fontWeight = style?.fontWeight ?? ''
    const isBold =
      tag === 'b' ||
      tag === 'strong' ||
      fontWeight === 'bold' ||
      fontWeight === 'bolder' ||
      (!Number.isNaN(parseInt(fontWeight)) && parseInt(fontWeight) >= 600)

    const isItalic =
      tag === 'i' ||
      tag === 'em' ||
      style?.fontStyle === 'italic'

    const textDecoration = style?.textDecoration ?? ''
    const textDecorationLine = style?.textDecorationLine ?? ''
    const isUnderline =
      tag === 'u' ||
      textDecoration.includes('underline') ||
      textDecorationLine.includes('underline')

    const safeColor = preserveColor ? sanitizeColorValue(style?.color ?? '') : null

    let result = inner
    if (inner.trim()) {
      if (isUnderline) result = `<u>${result}</u>`
      if (isItalic) result = `<i>${result}</i>`
      if (isBold) result = `<b>${result}</b>`
      if (safeColor) result = `<span style="color:${safeColor}">${result}</span>`
    }

    if (BLOCK_TAGS.includes(tag)) {
      return result + '\n'
    }

    return result
  }

  const normalized = walk(doc.body)
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return normalized ? normalized.replace(/\n/g, '<br />') : ''
}

export function extractEmphasisFromHtml(html: string, preserveColor = false): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? ''
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    if (tag === 'br') return '\n'
    if (['head', 'style', 'script', 'meta', 'link', 'iframe', 'object', 'embed'].includes(tag)) return ''

    const inner = Array.from(el.childNodes).map(walk).join('')
    const style = el.style

    const fontWeight = style?.fontWeight ?? ''
    const isBold =
      tag === 'b' ||
      tag === 'strong' ||
      fontWeight === 'bold' ||
      fontWeight === 'bolder' ||
      (!Number.isNaN(parseInt(fontWeight)) && parseInt(fontWeight) >= 600)

    const isItalic =
      tag === 'i' ||
      tag === 'em' ||
      style?.fontStyle === 'italic'

    const textDecoration = style?.textDecoration ?? ''
    const textDecorationLine = style?.textDecorationLine ?? ''
    const isUnderline =
      tag === 'u' ||
      textDecoration.includes('underline') ||
      textDecorationLine.includes('underline')

    const safeColor = preserveColor ? sanitizeColorValue(style?.color ?? '') : null

    let result = inner
    if (inner.trim()) {
      if (isUnderline) result = `<u>${result}</u>`
      if (isItalic) result = `<i>${result}</i>`
      if (isBold) result = `<b>${result}</b>`
      if (safeColor) result = `<span style="color:${safeColor}">${result}</span>`
    }

    if (BLOCK_TAGS.includes(tag)) {
      return result + '\n'
    }

    return result
  }

  return walk(doc.body)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
