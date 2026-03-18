import csv from 'csv-parser'
import { Readable } from 'stream'
import { BacklinkRow } from '../models/BacklinkRow.js'
import { BacklinkUpload } from '../models/BacklinkUpload.js'
import { mapRowKeys, normalizeRow, makeDedupeKey } from '../utils/csvSemrush.js'
import { recomputeAnalysesForManagedDomain } from './aggregateSourceDomains.js'

const BATCH = 1000

export async function processCsvBuffer(buffer, opts) {
  const { uploadId, managedDomainId, workspaceId, userId } = opts

  const rows = await new Promise((resolve, reject) => {
    const out = []
    const stream = Readable.from(buffer)
    stream
      .pipe(csv({ mapHeaders: ({ header }) => header }))
      .on('data', (row) => {
        const mapped = mapRowKeys(row)
        if (!mapped.sourceUrl) return
        const norm = normalizeRow(mapped)
        if (!norm.sourceRootDomain) return
        const dedupeKey = makeDedupeKey(norm.sourceUrl, norm.targetUrl, norm.anchor)
        out.push({
          uploadId,
          managedDomainId,
          workspaceId,
          sourceRootDomain: norm.sourceRootDomain,
          pageAscore: norm.pageAscore,
          sourceTitle: norm.sourceTitle,
          sourceUrl: norm.sourceUrl,
          targetUrl: norm.targetUrl,
          anchor: norm.anchor,
          externalLinks: norm.externalLinks,
          internalLinks: norm.internalLinks,
          nofollow: norm.nofollow,
          sponsored: norm.sponsored,
          ugc: norm.ugc,
          text: norm.text,
          frame: norm.frame,
          form: norm.form,
          image: norm.image,
          sitewide: norm.sitewide,
          firstSeen: norm.firstSeen,
          lastSeen: norm.lastSeen,
          newLink: norm.newLink,
          lostLink: norm.lostLink,
          rawRow: row,
          dedupeKey
        })
      })
      .on('end', () => resolve(out))
      .on('error', reject)
  })

  let rowCount = 0
  let duplicateCount = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    try {
      const res = await BacklinkRow.insertMany(chunk, { ordered: false })
      rowCount += res.length
    } catch (e) {
      if (e.insertedDocs && e.insertedDocs.length) {
        rowCount += e.insertedDocs.length
      }
      const errs = e.writeErrors || []
      for (const we of errs) {
        if (we.code === 11000) duplicateCount++
      }
      if (!e.writeErrors && e.code !== 11000) throw e
    }
  }

  const rec = await recomputeAnalysesForManagedDomain(managedDomainId, workspaceId, userId)
  await BacklinkUpload.findByIdAndUpdate(uploadId, {
    rowCount,
    duplicateCount,
    status: 'complete',
    workspaceBlacklistApplied: rec.workspaceBlacklistApplied ?? 0
  })
  return {
    rowCount,
    duplicateCount,
    workspaceBlacklistApplied: rec.workspaceBlacklistApplied ?? 0
  }
}
