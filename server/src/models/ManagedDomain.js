import mongoose from 'mongoose'

const managedDomainSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    domainName: { type: String, required: true, trim: true, lowercase: true },
    displayName: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
)

managedDomainSchema.index({ workspaceId: 1, domainName: 1 }, { unique: true })

export const ManagedDomain = mongoose.model('ManagedDomain', managedDomainSchema)
