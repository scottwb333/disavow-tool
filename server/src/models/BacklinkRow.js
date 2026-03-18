import mongoose from 'mongoose'

const backlinkRowSchema = new mongoose.Schema(
  {
    uploadId: { type: mongoose.Schema.Types.ObjectId, ref: 'BacklinkUpload', required: true },
    managedDomainId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManagedDomain', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    sourceRootDomain: { type: String, required: true, lowercase: true, index: true },
    pageAscore: { type: Number, default: null },
    sourceTitle: { type: String, default: '' },
    sourceUrl: { type: String, required: true },
    targetUrl: { type: String, default: '' },
    anchor: { type: String, default: '' },
    externalLinks: { type: Number, default: 0 },
    internalLinks: { type: Number, default: 0 },
    nofollow: { type: Boolean, default: false },
    sponsored: { type: Boolean, default: false },
    ugc: { type: Boolean, default: false },
    text: { type: Boolean, default: false },
    frame: { type: Boolean, default: false },
    form: { type: Boolean, default: false },
    image: { type: Boolean, default: false },
    sitewide: { type: Boolean, default: false },
    firstSeen: { type: Date, default: null },
    lastSeen: { type: Date, default: null },
    newLink: { type: Boolean, default: false },
    lostLink: { type: Boolean, default: false },
    rawRow: { type: mongoose.Schema.Types.Mixed, default: {} },
    dedupeKey: { type: String, default: '' }
  },
  { timestamps: true }
)

backlinkRowSchema.index({ managedDomainId: 1, sourceRootDomain: 1 })
backlinkRowSchema.index({ uploadId: 1 })
backlinkRowSchema.index({ managedDomainId: 1, dedupeKey: 1 }, { unique: true })

export const BacklinkRow = mongoose.model('BacklinkRow', backlinkRowSchema)
