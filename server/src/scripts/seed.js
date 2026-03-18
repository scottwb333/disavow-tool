/**
 * Optional: create indexes / sanity check Mongo connection.
 * Workspace creation requires a real Firebase user via the app.
 */
import 'dotenv/config'
import mongoose from 'mongoose'

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/disavow_tool'

async function main() {
  await mongoose.connect(uri)
  console.log('Connected. Collections will be created on first use.')
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
