const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const HypercoreId = require('hypercore-id-encoding')
const fsp = require('fs/promises')
const byteSize = require('tiny-byte-size')
const crayon = require('tiny-crayon')

module.exports = async function cmd (key, options = {}) {
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required as string')
  if (!options.corestore) options.corestore = './corestore'

  if (await stat(options.corestore) === null) errorAndExit('--corestore path does not exists')

  const store = new Corestore(options.corestore)
  const drive = new Hyperdrive(store, key ? HypercoreId.decode(key) : null)
  await drive.ready()

  console.log(crayon.gray('Loading drive info...'))
  console.log()

  console.log('Key:', crayon.magenta(HypercoreId.encode(drive.key)))
  if (drive.contentKey) console.log('Content key:', crayon.magenta(HypercoreId.encode(drive.contentKey)))

  console.log('Version:', drive.version)
  console.log('Writable?', drive.db.feed.writable)

  if (drive.blobs) {
    const dbInfo = await drive.db.feed.info({ storage: true })
    const blobsInfo = await drive.blobs.core.info({ storage: true })
    const total = calculateSize(dbInfo) + calculateSize(blobsInfo)

    console.log('Drive size:', crayon.cyan(byteSize(total)))
  }
}

function calculateSize (info) {
  return info.storage.oplog + info.storage.tree + info.storage.blocks + info.storage.bitfield
}

async function stat (path) {
  try {
    return await fsp.stat(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
