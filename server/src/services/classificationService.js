import { ClassificationRule } from '../models/ClassificationRule.js'
import { SourceDomainAnalysis } from '../models/SourceDomainAnalysis.js'

const normRootKey = (v) => String(v || '').toLowerCase().replace(/^www\./, '')

export async function getEffectiveDomainDecision(workspaceId, managedDomainId, sourceRootDomain) {
  const domain = String(sourceRootDomain).toLowerCase()
  const mdRules = await ClassificationRule.find({
    workspaceId,
    managedDomainId,
    entityType: 'source_domain',
    value: domain
  })
    .sort({ updatedAt: -1 })
    .lean()

  if (mdRules.length) {
    return { decision: mdRules[0].decision, rule: mdRules[0], scope: 'managed_domain' }
  }

  const wsRules = await ClassificationRule.find({
    workspaceId,
    managedDomainId: null,
    entityType: 'source_domain',
    value: domain
  })
    .sort({ updatedAt: -1 })
    .lean()

  if (wsRules.length) {
    return { decision: wsRules[0].decision, rule: wsRules[0], scope: 'workspace' }
  }

  return { decision: null, rule: null, scope: null }
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

export async function upsertRule({
  workspaceId,
  managedDomainId,
  entityType,
  value,
  decision,
  notes,
  userId,
  manual
}) {
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
  return doc
}

export async function deleteRule(ruleId, workspaceId) {
  return ClassificationRule.findOneAndDelete({ _id: ruleId, workspaceId })
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

    await upsertRule({
      workspaceId,
      managedDomainId,
      entityType: 'source_domain',
      value: domain,
      decision: 'blacklist',
      notes: 'Matched workspace disavow list on import',
      userId,
      manual: false
    })
    applied++
  }
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
