import fs from 'fs'
import csv from 'csv-parser'
import { BacklinkRow } from '../models/BacklinkRow.js'
import { BacklinkUpload } from '../models/BacklinkUpload.js'
import { mapRowKeys, normalizeRow, makeDedupeKey } from '../utils/csvSemrush.js'
import { recomputeAnalysesForManagedDomain } from './aggregateSourceDomains.js'

const BATCH = 800

function rowToDoc(row, opts) {
  const mapped = mapRowKeys(row)
  if (!mapped.sourceUrl) return null
  const norm = normalizeRow(mapped)
  if (!norm.sourceRootDomain) return null
  return {
    uploadId: opts.uploadId,
    managedDomainId: opts.managedDomainId,
    workspaceId: opts.workspaceId,
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
    dedupeKey: makeDedupeKey(norm.sourceUrl, norm.targetUrl, norm.anchor)
  }
}

async function insertChunk(chunk) {
  let inserted = 0
  let dups = 0
  if (!chunk.length) return { inserted, dups }
  try {
    const res = await BacklinkRow.insertMany(chunk, { ordered: false })
    inserted = res.length
  } catch (e) {
    if (e.insertedDocs?.length) inserted = e.insertedDocs.length
    for (const we of e.writeErrors || []) {
      if (we.code === 11000) dups++
    }
    if (!e.writeErrors && e.code !== 11000) throw e
  }
  return { inserted, dups }
}

export async function processCsvFileStream(filePath, opts) {
  const { uploadId, managedDomainId, workspaceId } = opts
  let batch = []
  let rowCount = 0
  let duplicateCount = 0

  const flushOneBatch = async () => {
    if (batch.length < BATCH) return
    const chunk = batch.splice(0, BATCH)
    const { inserted, dups } = await insertChunk(chunk)
    rowCount += inserted
    duplicateCount += dups
  }

  const flushRest = async () => {
    while (batch.length) {
      const chunk = batch.splice(0, Math.min(BATCH, batch.length))
      const { inserted, dups } = await insertChunk(chunk)
      rowCount += inserted
      duplicateCount += dups
    }
  }

  await new Promise((resolve, reject) => {
    let chain = Promise.resolve()
    const parser = fs.createReadStream(filePath, { encoding: 'utf8' }).pipe(
      csv({ mapHeaders: ({ header }) => header })
    )

    parser.on('data', (row) => {
      chain = chain
        .then(async () => {
          const doc = rowToDoc(row, { uploadId, managedDomainId, workspaceId })
          if (doc) batch.push(doc)
          if (batch.length >= BATCH) await flushOneBatch()
        })
        .catch(reject)
    })

    parser.on('end', () => {
      chain
        .then(async () => {
          await flushRest()
          resolve()
        })
        .catch(reject)
    })

    parser.on('error', reject)
  })

  const rec = await recomputeAnalysesForManagedDomain(
    managedDomainId,
    workspaceId,
    opts.userId
  )
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
