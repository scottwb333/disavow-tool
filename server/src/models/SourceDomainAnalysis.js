import mongoose from 'mongoose'

const sourceDomainAnalysisSchema = new mongoose.Schema(
  {
    managedDomainId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManagedDomain', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    sourceRootDomain: { type: String, required: true, lowercase: true },
    rowCount: { type: Number, default: 0 },
    uniqueSourceUrls: { type: Number, default: 0 },
    uniqueTargetUrls: { type: Number, default: 0 },
    uniqueAnchors: { type: Number, default: 0 },
    avgPageAscore: { type: Number, default: null },
    minPageAscore: { type: Number, default: null },
    maxPageAscore: { type: Number, default: null },
    nofollowCount: { type: Number, default: 0 },
    sponsoredCount: { type: Number, default: 0 },
    ugcCount: { type: Number, default: 0 },
    sitewideCount: { type: Number, default: 0 },
    newLinkCount: { type: Number, default: 0 },
    lostLinkCount: { type: Number, default: 0 },
    earliestFirstSeen: { type: Date, default: null },
    latestLastSeen: { type: Date, default: null },
    recommendation: {
      score: { type: Number, default: 0 },
      level: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
      flags: [{ type: String }],
      heuristicVersion: { type: String, default: '1' }
    },
    userApprovedForDisavow: { type: Boolean, default: false },
    lastComputedAt: { type: Date, default: Date.now },
    /** Cached from classification rules; refreshed on rule/import changes */
    effectiveDecision: { type: String, default: null }
  },
  { timestamps: true }
)

sourceDomainAnalysisSchema.index(
  { managedDomainId: 1, sourceRootDomain: 1 },
  { unique: true }
)
sourceDomainAnalysisSchema.index({ managedDomainId: 1, effectiveDecision: 1 })

export const SourceDomainAnalysis = mongoose.model('SourceDomainAnalysis', sourceDomainAnalysisSchema)
