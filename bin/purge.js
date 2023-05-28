const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const HypercoreId = require('hypercore-id-encoding')
const errorAndExit = require('../lib/exit.js')
const { findCorestore, noticeStorage } = require('../lib/find-corestore.js')

module.exports = async function cmd (key, options = {}) {
  if (options.storage && typeof options.storage !== 'string') errorAndExit('--storage <path> is required as string')

  const storage = await findCorestore(options)
  await noticeStorage(storage)

  // TODO: Corestore needs a method like store.exists(key) to avoid creating the drive unnecessarily
  const store = new Corestore(storage)
  const drive = new Hyperdrive(store, HypercoreId.decode(key))
  await drive.ready()

  console.log('Deleting drive...')
  await drive.purge()
  console.log('Drive deleted.')
}
