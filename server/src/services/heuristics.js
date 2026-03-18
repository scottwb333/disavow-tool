/**
 * Modular heuristic scorers — return { weight, flag } or null
 * Tune weights without touching UI
 */
const HEURISTIC_VERSION = '1'

const FREE_HOST_PATTERNS = [
  /\.blogspot\./i,
  /\.wordpress\.com$/i,
  /\.tumblr\.com$/i,
  /\.wixsite\.com$/i
]

const PRESS_SYNDICATION = [
  /ein-presswire/i,
  /prnewswire/i,
  /businesswire/i,
  /globenewswire/i,
  /press-release/i
]

function scoreHighExternalLinks(agg) {
  const ext = agg.maxExternalLinks ?? agg.avgExternalLinks ?? 0
  if (ext >= 5000) return { weight: 35, flag: 'very_high_external_links' }
  if (ext >= 2000) return { weight: 22, flag: 'high_external_links' }
  if (ext >= 800) return { weight: 12, flag: 'elevated_external_links' }
  return null
}

function scoreLowAuthority(agg) {
  const avg = agg.avgPageAscore
  if (avg == null) return null
  if (avg <= 5) return { weight: 28, flag: 'very_low_ascore' }
  if (avg <= 12) return { weight: 15, flag: 'low_ascore' }
  return null
}

function scoreSitewide(agg) {
  if (agg.sitewideCount >= 3) return { weight: 18, flag: 'multiple_sitewide' }
  if (agg.sitewideCount >= 1) return { weight: 8, flag: 'sitewide_present' }
  return null
}

function scoreFreeHost(domain) {
  for (const re of FREE_HOST_PATTERNS) {
    if (re.test(domain)) return { weight: 20, flag: 'free_host_blog' }
  }
  return null
}

function scorePressSyndication(sampleUrl) {
  if (!sampleUrl) return null
  for (const re of PRESS_SYNDICATION) {
    if (re.test(sampleUrl)) return { weight: 10, flag: 'press_syndication_pattern' }
  }
  return null
}

function scoreRepetitiveAnchors(agg) {
  if (agg.uniqueAnchors <= 2 && agg.rowCount >= 5) {
    return { weight: 12, flag: 'repetitive_anchors' }
  }
  return null
}

function scoreNewSuspicious(agg) {
  if (agg.newLinkCount >= agg.rowCount * 0.8 && agg.rowCount >= 3) {
    return { weight: 8, flag: 'mostly_new_links' }
  }
  return null
}

function scoreDirectoryFarm(domain, avgExt) {
  if (/directory|submit.*link|free.*listing|add.*url/i.test(domain) && avgExt > 100) {
    return { weight: 15, flag: 'directory_farm_signal' }
  }
  return null
}

export function runHeuristics({ sourceRootDomain, aggregates, sampleSourceUrl }) {
  let score = 0
  const flags = []
  const runners = [
    () => scoreHighExternalLinks(aggregates),
    () => scoreLowAuthority(aggregates),
    () => scoreSitewide(aggregates),
    () => scoreFreeHost(sourceRootDomain),
    () => scorePressSyndication(sampleSourceUrl),
    () => scoreRepetitiveAnchors(aggregates),
    () => scoreNewSuspicious(aggregates),
    () =>
      scoreDirectoryFarm(
        sourceRootDomain,
        aggregates.avgExternalLinks || 0
      )
  ]
  for (const run of runners) {
    const r = run()
    if (r) {
      score += r.weight
      flags.push(r.flag)
    }
  }
  let level = 'low'
  if (score >= 45) level = 'high'
  else if (score >= 22) level = 'medium'
  return {
    score: Math.min(100, score),
    level,
    flags,
    heuristicVersion: HEURISTIC_VERSION
  }
}
