const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const HypercoreId = require('hypercore-id-encoding')
const byteSize = require('tiny-byte-size')
const crayon = require('tiny-crayon')
const errorAndExit = require('./lib/exit.js')
const { findCorestore, noticeStorage } = require('./lib/find-corestore.js')

module.exports = async function cmd (key, options = {}) {
  if (options.storage && typeof options.storage !== 'string') errorAndExit('--storage <path> is required as string')

  const storage = await findCorestore(options)
  await noticeStorage(storage)

  // TODO: Corestore needs a method like store.exists(key) to avoid creating the drive unnecessarily
  const store = new Corestore(storage)
  const drive = new Hyperdrive(store, HypercoreId.decode(key))
  await drive.ready()

  console.log('Key:', crayon.magenta(HypercoreId.encode(drive.key)))
  if (drive.contentKey) console.log('Content key:', crayon.magenta(HypercoreId.encode(drive.contentKey)))

  console.log('Version:', drive.version)
  console.log('Writable?', drive.db.feed.writable)
  console.log('Files length:', crayon.yellow(drive.core.contiguousLength) + '/' + crayon.yellow(drive.core.length))

  if (drive.blobs) {
    console.log('Blobs length:', crayon.yellow(drive.blobs.core.contiguousLength) + '/' + crayon.yellow(drive.blobs.core.length))

    const dbInfo = await drive.db.feed.info({ storage: true })
    const blobsInfo = await drive.blobs.core.info({ storage: true })
    const total = calculateSize(dbInfo) + calculateSize(blobsInfo)

    console.log('Drive size:', crayon.cyan(byteSize(total)))
  }
}

function calculateSize (info) {
  return info.storage.oplog + info.storage.tree + info.storage.blocks + info.storage.bitfield
}
