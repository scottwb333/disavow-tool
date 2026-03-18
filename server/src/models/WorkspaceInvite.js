import mongoose from 'mongoose'

const workspaceInviteSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    token: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
)

workspaceInviteSchema.index({ workspaceId: 1, email: 1 }, { unique: true })

export const WorkspaceInvite = mongoose.model('WorkspaceInvite', workspaceInviteSchema)
