import { ClassificationRule } from '../models/ClassificationRule.js'
import { SourceDomainAnalysis } from '../models/SourceDomainAnalysis.js'
import { ManagedDomain } from '../models/ManagedDomain.js'
import { Workspace } from '../models/Workspace.js'
import {
  getEffectiveDomainDecision,
  isUrlWhitelistedForManagedDomain
} from './classificationService.js'

function disavowLineForDomain(domain) {
  const d = String(domain).toLowerCase().replace(/^www\./, '')
  return `domain:${d}`
}

export async function buildDisavowContent({ workspaceId, managedDomainId }) {
  const md = await ManagedDomain.findById(managedDomainId).lean()
  const ws = await Workspace.findById(workspaceId).lean()
  if (!md || !ws) {
    const e = new Error('Domain or workspace not found')
    e.status = 404
    throw e
  }

  const domainSet = new Map()
  const urlSet = new Set()

  const considerDomain = async (d) => {
    const root = String(d).toLowerCase().replace(/^www\./, '')
    const eff = await getEffectiveDomainDecision(workspaceId, managedDomainId, root)
    if (eff.decision === 'whitelist') return
    domainSet.set(root, true)
  }

  const wsRules = await ClassificationRule.find({
    workspaceId,
    managedDomainId: null
  }).lean()

  for (const r of wsRules) {
    if (r.decision !== 'blacklist') continue
    if (r.entityType === 'source_domain') {
      await considerDomain(r.value)
    } else {
      const skip = await isUrlWhitelistedForManagedDomain(
        workspaceId,
        managedDomainId,
        r.value
      )
      if (!skip) urlSet.add(String(r.value).trim())
    }
  }

  const mdRules = await ClassificationRule.find({
    workspaceId,
    managedDomainId,
    decision: 'blacklist'
  }).lean()

  for (const r of mdRules) {
    if (r.entityType === 'source_domain') {
      domainSet.set(String(r.value).toLowerCase().replace(/^www\./, ''), true)
    } else {
      urlSet.add(String(r.value).trim())
    }
  }

  const approved = await SourceDomainAnalysis.find({
    managedDomainId,
    userApprovedForDisavow: true
  }).lean()
  for (const a of approved) {
    const eff = await getEffectiveDomainDecision(workspaceId, managedDomainId, a.sourceRootDomain)
    if (eff.decision !== 'whitelist') {
      domainSet.set(a.sourceRootDomain, true)
    }
  }

  const lines = []
  const now = new Date().toISOString().slice(0, 10)
  lines.push(`# Generated for ${md.domainName}`)
  lines.push(`# Workspace: ${ws.name}`)
  lines.push(`# Created on ${now}`)
  lines.push('')

  const domains = [...domainSet.keys()].sort()
  for (const d of domains) {
    lines.push(disavowLineForDomain(d))
  }
  const urls = [...urlSet].sort()
  for (const u of urls) {
    lines.push(u)
  }

  const content = `${lines.join('\n')}\n`
  return {
    content,
    entrySummary: { domainCount: domains.length, urlCount: urls.length }
  }
}
