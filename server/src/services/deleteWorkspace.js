import mongoose from 'mongoose'
import { BacklinkRow } from '../models/BacklinkRow.js'
import { BacklinkUpload } from '../models/BacklinkUpload.js'
import { SourceDomainAnalysis } from '../models/SourceDomainAnalysis.js'
import { GeneratedDisavow } from '../models/GeneratedDisavow.js'
import { ClassificationRule } from '../models/ClassificationRule.js'
import { ManagedDomain } from '../models/ManagedDomain.js'
import { WorkspaceMember } from '../models/WorkspaceMember.js'
import { WorkspaceInvite } from '../models/WorkspaceInvite.js'
import { Workspace } from '../models/Workspace.js'
import { invalidateClassificationRuleCaches } from './classificationService.js'

/**
 * Permanently remove a workspace and every document tied to it.
 */
export async function deleteWorkspaceAndData(workspaceId) {
  const id =
    workspaceId instanceof mongoose.Types.ObjectId
      ? workspaceId
      : new mongoose.Types.ObjectId(String(workspaceId))

  await BacklinkRow.deleteMany({ workspaceId: id })
  await BacklinkUpload.deleteMany({ workspaceId: id })
  await SourceDomainAnalysis.deleteMany({ workspaceId: id })
  await GeneratedDisavow.deleteMany({ workspaceId: id })
  await ClassificationRule.deleteMany({ workspaceId: id })
  await ManagedDomain.deleteMany({ workspaceId: id })
  await WorkspaceMember.deleteMany({ workspaceId: id })
  await WorkspaceInvite.deleteMany({ workspaceId: id })
  await Workspace.findByIdAndDelete(id)
  invalidateClassificationRuleCaches(id)
}
