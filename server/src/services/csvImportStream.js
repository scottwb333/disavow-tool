import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import csv from 'csv-parser'
import { BacklinkRow } from '../models/BacklinkRow.js'
import { BacklinkUpload } from '../models/BacklinkUpload.js'
import { excelBufferToRowRecords, isExcelExtension } from '../utils/excelRows.js'
import { rowObjectToDoc } from './csvImportService.js'
import { recomputeAnalysesForManagedDomain } from './aggregateSourceDomains.js'

const BATCH = 800

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

async function finalizeUpload(uploadId, managedDomainId, workspaceId, userId, rowCount, duplicateCount) {
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

async function runBatchedImportFromRecords(records, opts) {
  const { uploadId, managedDomainId, workspaceId, userId } = opts
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

  for (const row of records) {
    const doc = rowObjectToDoc(row, opts)
    if (doc) batch.push(doc)
    if (batch.length >= BATCH) await flushOneBatch()
  }
  await flushRest()

  return finalizeUpload(uploadId, managedDomainId, workspaceId, userId, rowCount, duplicateCount)
}

export async function processCsvFileStreamOnly(filePath, opts) {
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
          const doc = rowObjectToDoc(row, opts)
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

  return finalizeUpload(
    uploadId,
    managedDomainId,
    workspaceId,
    opts.userId,
    rowCount,
    duplicateCount
  )
}

/** CSV (streamed) or Excel .xlsx / .xls (buffered first sheet). */
export async function processImportFile(filePath, opts) {
  const ext = path.extname(filePath).toLowerCase()
  if (isExcelExtension(ext)) {
    const buf = await fsPromises.readFile(filePath)
    const records = excelBufferToRowRecords(buf)
    return runBatchedImportFromRecords(records, opts)
  }
  return processCsvFileStreamOnly(filePath, opts)
}

export const processCsvFileStream = processImportFile
