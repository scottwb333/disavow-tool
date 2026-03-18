import mongoose from 'mongoose'
import { BacklinkRow } from '../models/BacklinkRow.js'
import { SourceDomainAnalysis } from '../models/SourceDomainAnalysis.js'
import { runHeuristics } from './heuristics.js'
import { refreshEffectiveDecisionsForManagedDomain } from './effectiveDecisionCache.js'
import { applyWorkspaceBlacklistToManagedDomainSources } from './classificationService.js'

export async function recomputeAnalysesForManagedDomain(managedDomainId, workspaceId, userId = null) {
  const mdId =
    typeof managedDomainId === 'string'
      ? new mongoose.Types.ObjectId(managedDomainId)
      : managedDomainId
  const wsId =
    typeof workspaceId === 'string' ? new mongoose.Types.ObjectId(workspaceId) : workspaceId

  const pipeline = [
    { $match: { managedDomainId: mdId } },
    {
      $group: {
        _id: '$sourceRootDomain',
        rowCount: { $sum: 1 },
        sourceUrls: { $addToSet: '$sourceUrl' },
        targetUrls: { $addToSet: '$targetUrl' },
        anchors: { $addToSet: '$anchor' },
        avgPageAscore: { $avg: '$pageAscore' },
        minPageAscore: { $min: '$pageAscore' },
        maxPageAscore: { $max: '$pageAscore' },
        maxExternal: { $max: '$externalLinks' },
        avgExternal: { $avg: '$externalLinks' },
        nofollowCount: { $sum: { $cond: ['$nofollow', 1, 0] } },
        sponsoredCount: { $sum: { $cond: ['$sponsored', 1, 0] } },
        ugcCount: { $sum: { $cond: ['$ugc', 1, 0] } },
        sitewideCount: { $sum: { $cond: ['$sitewide', 1, 0] } },
        newLinkCount: { $sum: { $cond: ['$newLink', 1, 0] } },
        lostLinkCount: { $sum: { $cond: ['$lostLink', 1, 0] } },
        earliestFirstSeen: { $min: '$firstSeen' },
        latestLastSeen: { $max: '$lastSeen' },
        sampleSourceUrl: { $first: '$sourceUrl' }
      }
    }
  ]

  const groups = await BacklinkRow.aggregate(pipeline)
  await SourceDomainAnalysis.deleteMany({ managedDomainId: mdId })

  const docs = []
  for (const g of groups) {
    const domain = g._id
    if (!domain) continue
    const sourceUrls = g.sourceUrls || []
    const targetUrls = (g.targetUrls || []).filter(Boolean)
    const anchors = (g.anchors || []).filter((a) => a != null && String(a).length > 0)

    const aggregates = {
      avgPageAscore: g.avgPageAscore,
      maxExternalLinks: g.maxExternal,
      avgExternalLinks: g.avgExternal,
      sitewideCount: g.sitewideCount,
      uniqueAnchors: anchors.length,
      rowCount: g.rowCount,
      newLinkCount: g.newLinkCount
    }

    const recommendation = runHeuristics({
      sourceRootDomain: domain,
      aggregates,
      sampleSourceUrl: g.sampleSourceUrl
    })

    docs.push({
      managedDomainId: mdId,
      workspaceId: wsId,
      sourceRootDomain: domain,
      rowCount: g.rowCount,
      uniqueSourceUrls: sourceUrls.length,
      uniqueTargetUrls: targetUrls.length,
      uniqueAnchors: anchors.length,
      avgPageAscore: g.avgPageAscore != null ? Math.round(g.avgPageAscore * 100) / 100 : null,
      minPageAscore: g.minPageAscore,
      maxPageAscore: g.maxPageAscore,
      nofollowCount: g.nofollowCount,
      sponsoredCount: g.sponsoredCount,
      ugcCount: g.ugcCount,
      sitewideCount: g.sitewideCount,
      newLinkCount: g.newLinkCount,
      lostLinkCount: g.lostLinkCount,
      earliestFirstSeen: g.earliestFirstSeen || null,
      latestLastSeen: g.latestLastSeen || null,
      recommendation,
      lastComputedAt: new Date()
    })
  }

  if (docs.length) {
    await SourceDomainAnalysis.insertMany(docs)
  }
  let workspaceBlacklistApplied = 0
  if (userId && docs.length) {
    workspaceBlacklistApplied = await applyWorkspaceBlacklistToManagedDomainSources({
      workspaceId: wsId,
      managedDomainId: mdId,
      userId
    })
  }
  await refreshEffectiveDecisionsForManagedDomain(mdId, wsId)
  return { analysisCount: docs.length, workspaceBlacklistApplied }
}
