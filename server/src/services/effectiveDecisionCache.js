import mongoose from 'mongoose'
import { SourceDomainAnalysis } from '../models/SourceDomainAnalysis.js'
import { ManagedDomain } from '../models/ManagedDomain.js'
import { getEffectiveDomainDecision } from './classificationService.js'

const PARALLEL_FULL_REFRESH = 48

function toObjectId(id) {
  if (id instanceof mongoose.Types.ObjectId) return id
  return new mongoose.Types.ObjectId(String(id))
}

/** Update cached effectiveDecision only for these source roots (fast path for classify / undo). */
export async function refreshEffectiveDecisionsForManagedDomainSources(
  workspaceId,
  managedDomainId,
  sourceRootDomains
) {
  const roots = [
    ...new Set(
      (Array.isArray(sourceRootDomains) ? sourceRootDomains : [sourceRootDomains])
        .map((r) => String(r || '').toLowerCase())
        .filter(Boolean)
    )
  ]
  if (!roots.length) return
  const mdId = toObjectId(managedDomainId)
  const wsId = toObjectId(workspaceId)
  const analyses = await SourceDomainAnalysis.find({
    managedDomainId: mdId,
    sourceRootDomain: { $in: roots }
  })
    .select('_id sourceRootDomain')
    .lean()
  if (!analyses.length) return
  const bulk = []
  for (const a of analyses) {
    const eff = await getEffectiveDomainDecision(wsId, mdId, a.sourceRootDomain)
    bulk.push({
      updateOne: {
        filter: { _id: a._id },
        update: { $set: { effectiveDecision: eff.decision ?? null } }
      }
    })
  }
  if (bulk.length) await SourceDomainAnalysis.bulkWrite(bulk)
}

/** After a workspace-wide source_domain rule changes, refresh that root across all managed domains. */
export async function refreshEffectiveDecisionAcrossWorkspaceForSource(workspaceId, sourceRootDomain) {
  const domain = String(sourceRootDomain || '').toLowerCase()
  if (!domain) return
  const wsId = toObjectId(workspaceId)
  const mds = await ManagedDomain.find({ workspaceId: wsId }).select('_id').lean()
  for (const d of mds) {
    await refreshEffectiveDecisionsForManagedDomainSources(wsId, d._id, [domain])
  }
}

export async function refreshEffectiveDecisionsForManagedDomain(managedDomainId, workspaceId) {
  const mdId = toObjectId(managedDomainId)
  const wsId = toObjectId(workspaceId)
  const analyses = await SourceDomainAnalysis.find({ managedDomainId: mdId })
    .select('_id sourceRootDomain')
    .lean()
  if (!analyses.length) return
  for (let i = 0; i < analyses.length; i += PARALLEL_FULL_REFRESH) {
    const slice = analyses.slice(i, i + PARALLEL_FULL_REFRESH)
    const rows = await Promise.all(
      slice.map((a) =>
        getEffectiveDomainDecision(wsId, mdId, a.sourceRootDomain).then((eff) => ({
          _id: a._id,
          decision: eff.decision ?? null
        }))
      )
    )
    await SourceDomainAnalysis.bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { _id: r._id },
          update: { $set: { effectiveDecision: r.decision } }
        }
      }))
    )
  }
}

export async function refreshEffectiveDecisionsForWorkspace(workspaceId) {
  const wsId = toObjectId(workspaceId)
  const domains = await ManagedDomain.find({ workspaceId: wsId }).select('_id').lean()
  for (const d of domains) {
    await refreshEffectiveDecisionsForManagedDomain(d._id, wsId)
  }
}
