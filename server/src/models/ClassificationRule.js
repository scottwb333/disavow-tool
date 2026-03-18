import mongoose from 'mongoose'

const classificationRuleSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    managedDomainId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManagedDomain', default: null },
    entityType: { type: String, enum: ['source_domain', 'source_url'], required: true },
    value: { type: String, required: true },
    decision: {
      type: String,
      enum: ['whitelist', 'blacklist', 'needs_review', 'ignore'],
      required: true
    },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    manual: { type: Boolean, default: false }
  },
  { timestamps: true }
)

classificationRuleSchema.index({
  workspaceId: 1,
  managedDomainId: 1,
  entityType: 1,
  value: 1
})

export const ClassificationRule = mongoose.model('ClassificationRule', classificationRuleSchema)
