import { parse as parseTld } from 'tldts'
import crypto from 'crypto'

const HEADER_ALIASES = {
  'page ascore': 'pageAscore',
  'source title': 'sourceTitle',
  'source url': 'sourceUrl',
  // Agency Analytics (and similar) exports
  link: 'sourceUrl',
  'anchor text': 'anchor',
  'trust flow': 'trustFlow',
  'citation flow': 'citationFlow',
  'target url': 'targetUrl',
  anchor: 'anchor',
  'external links': 'externalLinks',
  'internal links': 'internalLinks',
  nofollow: 'nofollow',
  sponsored: 'sponsored',
  ugc: 'ugc',
  text: 'text',
  frame: 'frame',
  form: 'form',
  image: 'image',
  sitewide: 'sitewide',
  'first seen': 'firstSeen',
  'last seen': 'lastSeen',
  'new link': 'newLink',
  'lost link': 'lostLink'
}

export function normalizeHeaderKey(key) {
  if (key == null) return ''
  return String(key).trim().replace(/^\ufeff/, '').toLowerCase()
}

export function mapRowKeys(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeHeaderKey(k)
    const field = HEADER_ALIASES[nk]
    if (field) out[field] = v
    else out[`_${nk}`] = v
  }
  return out
}

export function parseBool(val) {
  if (val === true || val === false) return val
  const s = String(val ?? '').trim().toUpperCase()
  return s === 'TRUE' || s === '1' || s === 'YES'
}

export function parseDate(val) {
  if (!val || String(val).trim() === '') return null
  const d = new Date(val)
  if (!Number.isNaN(d.getTime())) return d
  const m = String(val).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    let y = parseInt(m[3], 10)
    if (y < 100) y += 2000
    const mo = parseInt(m[1], 10) - 1
    const day = parseInt(m[2], 10)
    return new Date(y, mo, day)
  }
  return null
}

export function parseIntSafe(val) {
  const n = parseInt(String(val ?? '').replace(/,/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

export function parseFloatSafe(val) {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

export function rootDomainFromSourceUrl(sourceUrl) {
  try {
    const u = new URL(String(sourceUrl).trim())
    const host = u.hostname.toLowerCase()
    const r = parseTld(host)
    if (r.domain) return r.domain
    return host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function makeDedupeKey(sourceUrl, targetUrl, anchor) {
  const s = `${String(sourceUrl)}|${String(targetUrl)}|${String(anchor)}`
  return crypto.createHash('sha256').update(s).digest('hex')
}

function targetUrlFromAnchor(anchor) {
  const a = String(anchor || '').trim()
  if (/^https?:\/\//i.test(a)) return a
  return ''
}

export function normalizeRow(mapped) {
  const sourceUrl = String(mapped.sourceUrl || '').trim()
  let pageAscore = parseFloatSafe(mapped.pageAscore)
  const tf = mapped.trustFlow
  if (
    (pageAscore === null || pageAscore === undefined) &&
    tf != null &&
    String(tf).trim() !== ''
  ) {
    const n = parseFloatSafe(tf)
    if (n !== null) {
      if (n < 10) {
        // Majestic TF under 10 = weak source — map into low “pageAscore” band for risk heuristics
        pageAscore = Math.round(Math.min(4.99, Math.max(0, n * 0.5)) * 100) / 100
      } else {
        // TF 10+ treated as acceptable+; bump slightly so avg clears generic low-ascore threshold
        pageAscore = Math.min(100, n + 5)
      }
    }
  }
  let targetUrl = String(mapped.targetUrl || '').trim()
  const anchor = String(mapped.anchor || '')
  if (!targetUrl) targetUrl = targetUrlFromAnchor(anchor)
  return {
    pageAscore,
    sourceTitle: String(mapped.sourceTitle || ''),
    sourceUrl,
    targetUrl,
    anchor,
    externalLinks: parseIntSafe(mapped.externalLinks),
    internalLinks: parseIntSafe(mapped.internalLinks),
    nofollow: parseBool(mapped.nofollow),
    sponsored: parseBool(mapped.sponsored),
    ugc: parseBool(mapped.ugc),
    text: parseBool(mapped.text),
    frame: parseBool(mapped.frame),
    form: parseBool(mapped.form),
    image: parseBool(mapped.image),
    sitewide: parseBool(mapped.sitewide),
    firstSeen: parseDate(mapped.firstSeen),
    lastSeen: parseDate(mapped.lastSeen),
    newLink: parseBool(mapped.newLink),
    lostLink: parseBool(mapped.lostLink),
    sourceRootDomain: rootDomainFromSourceUrl(sourceUrl)
  }
}
