import mongoose from 'mongoose'

const backlinkUploadSchema = new mongoose.Schema(
  {
    managedDomainId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManagedDomain', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    filename: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rowCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    status: { type: String, enum: ['processing', 'complete', 'failed'], default: 'processing' },
    errorMessage: { type: String, default: '' },
    /** Domains auto-blacklisted from workspace list after this import */
    workspaceBlacklistApplied: { type: Number, default: 0 }
  },
  { timestamps: true }
)

backlinkUploadSchema.index({ managedDomainId: 1, createdAt: -1 })

export const BacklinkUpload = mongoose.model('BacklinkUpload', backlinkUploadSchema)
