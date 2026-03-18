import mongoose from 'mongoose'

const workspaceMemberSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' }
  },
  { timestamps: true }
)

workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true })
workspaceMemberSchema.index({ userId: 1 })

export const WorkspaceMember = mongoose.model('WorkspaceMember', workspaceMemberSchema)
