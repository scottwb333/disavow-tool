import mongoose from 'mongoose'

const generatedDisavowSchema = new mongoose.Schema(
  {
    managedDomainId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManagedDomain', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    content: { type: String, required: true },
    lineCount: { type: Number, default: 0 },
    entrySummary: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
)

generatedDisavowSchema.index({ managedDomainId: 1, createdAt: -1 })

export const GeneratedDisavow = mongoose.model('GeneratedDisavow', generatedDisavowSchema)
