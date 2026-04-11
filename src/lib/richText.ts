/**
 * richText.ts
 *
 * Extrai do HTML do clipboard APENAS as ênfases semânticas:
 *   <b>  negrito
 *   <i>  itálico
 *   <u>  sublinhado
 *
 * Tudo o mais (fonte, tamanho, cor, espaçamento, alinhamento) é descartado.
 * O texto resultante segue o padrão visual do ProvaMax — só a ênfase é preservada.
 */

/**
 * Lê HTML do clipboard e devolve texto puro com apenas <b>, <i>, <u>.
 * Elementos de bloco viram quebra de linha. Nenhum outro estilo sobrevive.
 */
/**
 * @param preserveColor  Se true, preserva também a cor inline (para o campo comentário).
 *                       Em todos os outros campos deve ser false (padrão).
 */
export function extractEmphasisFromHtml(html: string, preserveColor = false): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  function walk(node: Node): string {
    // Nó de texto: devolve o conteúdo literal
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? ''
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    // Quebra de linha explícita
    if (tag === 'br') return '\n'

    // Elementos sem conteúdo útil
    if (['head', 'style', 'script', 'meta', 'link'].includes(tag)) return ''

    // Processa filhos primeiro
    const inner = Array.from(el.childNodes).map(walk).join('')

    const style = el.style

    // ── Detectar negrito ─────────────────────────────────────────────────────
    const fw = style?.fontWeight ?? ''
    const isBold =
      tag === 'b' ||
      tag === 'strong' ||
      fw === 'bold' ||
      fw === 'bolder' ||
      (!isNaN(parseInt(fw)) && parseInt(fw) >= 600)

    // ── Detectar itálico ─────────────────────────────────────────────────────
    const isItalic =
      tag === 'i' ||
      tag === 'em' ||
      style?.fontStyle === 'italic'

    // ── Detectar sublinhado ──────────────────────────────────────────────────
    const td  = style?.textDecoration ?? ''
    const tdl = style?.textDecorationLine ?? ''
    const isUnderline =
      tag === 'u' ||
      td.includes('underline') ||
      tdl.includes('underline')

    // ── Detectar cor (apenas quando preserveColor = true) ────────────────────
    const color = preserveColor ? (style?.color ?? '') : ''

    // Aplica as tags de ênfase (somente quando o conteúdo não é vazio)
    let result = inner
    if (inner.trim()) {
      if (isUnderline) result = `<u>${result}</u>`
      if (isItalic)    result = `<i>${result}</i>`
      if (isBold)      result = `<b>${result}</b>`
      if (color)       result = `<span style="color:${color}">${result}</span>`
    }

    // Elementos de bloco → adiciona quebra de linha após
    const blockTags = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'td', 'thead', 'tbody']
    if (blockTags.includes(tag)) {
      return result + '\n'
    }

    return result
  }

  return walk(doc.body)
    .replace(/\n{3,}/g, '\n\n') // máximo 2 quebras consecutivas
    .trim()
}
