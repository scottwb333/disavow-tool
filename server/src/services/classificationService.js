import { BacklinkRow } from '../models/BacklinkRow.js'
import { ClassificationRule } from '../models/ClassificationRule.js'
import { SourceDomainAnalysis } from '../models/SourceDomainAnalysis.js'

/** Strip www; compare so workspace rule "evil.com" matches CSV root "www.evil.com". */
export const normRootKeyForSource = (v) =>
  String(v || '')
    .toLowerCase()
    .replace(/^www\./, '')

const normRootKey = normRootKeyForSource

const RULE_CACHE_TTL_MS = 60_000
const wsRulesCache = new Map()
const mdRulesCache = new Map()

export function invalidateClassificationRuleCaches(workspaceId) {
  const id = String(workspaceId)
  wsRulesCache.delete(id)
  for (const k of mdRulesCache.keys()) {
    if (String(k).startsWith(`${id}:`)) mdRulesCache.delete(k)
  }
}

async function getMdSourceDomainRulesCached(workspaceId, managedDomainId) {
  const k = `${workspaceId}:${managedDomainId}`
  const now = Date.now()
  const hit = mdRulesCache.get(k)
  if (hit && now - hit.t < RULE_CACHE_TTL_MS) return hit.rules
  const rules = await ClassificationRule.find({
    workspaceId,
    managedDomainId,
    entityType: 'source_domain'
  }).lean()
  mdRulesCache.set(k, { rules, t: now })
  return rules
}

async function getWsSourceDomainRulesCached(workspaceId) {
  const id = String(workspaceId)
  const now = Date.now()
  const hit = wsRulesCache.get(id)
  if (hit && now - hit.t < RULE_CACHE_TTL_MS) return hit.rules
  const rules = await ClassificationRule.find({
    workspaceId,
    managedDomainId: null,
    entityType: 'source_domain'
  }).lean()
  wsRulesCache.set(id, { rules, t: now })
  return rules
}

/** Warm caches before batch refresh (avoids thundering herd). */
export async function primeClassificationRuleCaches(workspaceId, managedDomainId) {
  await Promise.all([
    getWsSourceDomainRulesCached(workspaceId),
    getMdSourceDomainRulesCached(workspaceId, managedDomainId)
  ])
}

export async function getEffectiveDomainDecision(workspaceId, managedDomainId, sourceRootDomain) {
  const key = normRootKey(sourceRootDomain)
  if (!key) return { decision: null, rule: null, scope: null }

  const mdRules = await getMdSourceDomainRulesCached(workspaceId, managedDomainId)
  const mdMatch = mdRules
    .filter((r) => normRootKey(r.value) === key)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]
  if (mdMatch) {
    return { decision: mdMatch.decision, rule: mdMatch, scope: 'managed_domain' }
  }

  const wsRules = await getWsSourceDomainRulesCached(workspaceId)
  const wsMatch = wsRules
    .filter((r) => normRootKey(r.value) === key)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]
  if (wsMatch) {
    return { decision: wsMatch.decision, rule: wsMatch, scope: 'workspace' }
  }

  return { decision: null, rule: null, scope: null }
}

function rulesLatestByNormKey(rules) {
  const m = new Map()
  for (const r of rules) {
    const k = normRootKey(r.value)
    if (!k) continue
    const prev = m.get(k)
    if (!prev || new Date(r.updatedAt) > new Date(prev.updatedAt)) m.set(k, r)
  }
  return m
}

/**
 * Fast O(1) lookup per root — same outcome as getEffectiveDomainDecision for source_domain rules.
 * Use for bulk flows; avoid refreshEffectiveDecisionsForManagedDomain on whole domains.
 */
export async function createSourceDomainDecisionLookup(workspaceId, managedDomainId) {
  const [mdRules, wsRules] = await Promise.all([
    ClassificationRule.find({
      workspaceId,
      managedDomainId,
      entityType: 'source_domain'
    }).lean(),
    ClassificationRule.find({
      workspaceId,
      managedDomainId: null,
      entityType: 'source_domain'
    }).lean()
  ])
  const mdByKey = rulesLatestByNormKey(mdRules)
  const wsByKey = rulesLatestByNormKey(wsRules)
  return function lookup(sourceRootDomain) {
    const k = normRootKey(sourceRootDomain)
    if (!k) return { decision: null, scope: null }
    const md = mdByKey.get(k)
    if (md) return { decision: md.decision, scope: 'managed_domain' }
    const ws = wsByKey.get(k)
    if (ws) return { decision: ws.decision, scope: 'workspace' }
    return { decision: null, scope: null }
  }
}

export async function isUrlWhitelistedForManagedDomain(workspaceId, managedDomainId, url) {
  const u = String(url).trim()
  const r = await ClassificationRule.findOne({
    workspaceId,
    managedDomainId,
    entityType: 'source_url',
    value: u,
    decision: 'whitelist'
  }).lean()
  return !!r
}

export async function listRulesForWorkspace(workspaceId, { managedDomainId } = {}) {
  const q = { workspaceId }
  if (managedDomainId === null) q.managedDomainId = null
  else if (managedDomainId) q.managedDomainId = managedDomainId
  return ClassificationRule.find(q).sort({ updatedAt: -1 }).lean()
}

export async function upsertRule(
  {
    workspaceId,
    managedDomainId,
    entityType,
    value,
    decision,
    notes,
    userId,
    manual
  },
  { skipCacheInvalidate = false } = {}
) {
  const v =
    entityType === 'source_domain'
      ? String(value).toLowerCase().trim()
      : String(value).trim()

  const doc = await ClassificationRule.findOneAndUpdate(
    {
      workspaceId,
      managedDomainId: managedDomainId || null,
      entityType,
      value: v
    },
    {
      $set: {
        decision,
        notes: notes || '',
        manual: !!manual,
        createdBy: userId
      },
      $setOnInsert: {
        workspaceId,
        managedDomainId: managedDomainId || null,
        entityType,
        value: v
      }
    },
    { upsert: true, new: true, runValidators: true }
  )
  if (!skipCacheInvalidate) invalidateClassificationRuleCaches(workspaceId)
  return doc
}

export async function deleteRule(ruleId, workspaceId) {
  const r = await ClassificationRule.findOneAndDelete({ _id: ruleId, workspaceId })
  if (r) invalidateClassificationRuleCaches(workspaceId)
  return r
}

export async function setAnalysisApproval(managedDomainId, sourceRootDomain, approved) {
  return SourceDomainAnalysis.findOneAndUpdate(
    { managedDomainId, sourceRootDomain: String(sourceRootDomain).toLowerCase() },
    { $set: { userApprovedForDisavow: !!approved } },
    { new: true }
  )
}

/**
 * For each source root present in backlink data, if it appears on the workspace
 * global blacklist, upsert a per-managed-domain blacklist (skips existing per-site whitelist).
 */
export async function applyWorkspaceBlacklistToManagedDomainSources({
  workspaceId,
  managedDomainId,
  userId
}) {
  if (!userId) return 0
  const wsRules = await ClassificationRule.find({
    workspaceId,
    managedDomainId: null,
    entityType: 'source_domain',
    decision: 'blacklist'
  })
    .select('value')
    .lean()
  const globalSet = new Set(wsRules.map((r) => normRootKey(r.value)))
  if (!globalSet.size) return 0

  const roots = await BacklinkRow.distinct('sourceRootDomain', { managedDomainId })
  let applied = 0
  for (const root of roots) {
    if (!root) continue
    const domain = String(root).toLowerCase()
    if (!globalSet.has(normRootKey(domain))) continue

    const existing = await ClassificationRule.findOne({
      workspaceId,
      managedDomainId,
      entityType: 'source_domain',
      value: domain
    }).lean()
    if (existing?.decision === 'whitelist') continue

    await upsertRule(
      {
        workspaceId,
        managedDomainId,
        entityType: 'source_domain',
        value: domain,
        decision: 'blacklist',
        notes: 'Matched workspace disavow list on import',
        userId,
        manual: false
      },
      { skipCacheInvalidate: true }
    )
    applied++
  }
  if (applied) invalidateClassificationRuleCaches(workspaceId)
  return applied
}

/**
 * Remove this source from the disavow set for the managed domain: drop per-site rule, then
 * whitelist at site level if a workspace blacklist would still apply.
 */
export async function revertDisavowForSource({
  workspaceId,
  managedDomainId,
  sourceRootDomain,
  userId
}) {
  const domain = String(sourceRootDomain).toLowerCase()
  await ClassificationRule.deleteOne({
    workspaceId,
    managedDomainId,
    entityType: 'source_domain',
    value: domain
  })
  const eff = await getEffectiveDomainDecision(workspaceId, managedDomainId, domain)
  if (eff.decision === 'blacklist') {
    await upsertRule({
      workspaceId,
      managedDomainId,
      entityType: 'source_domain',
      value: domain,
      decision: 'whitelist',
      notes: 'Excluded from disavow for this property (workspace rule overridden)',
      userId,
      manual: true
    })
  }
  await setAnalysisApproval(managedDomainId, domain, false)
}
