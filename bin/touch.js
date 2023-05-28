const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const HypercoreId = require('hypercore-id-encoding')
const crayon = require('tiny-crayon')
const errorAndExit = require('../lib/exit.js')
const { findCorestore, noticeStorage } = require('../lib/find-corestore.js')

module.exports = async function cmd (options = {}) {
  if (options.storage && typeof options.storage !== 'string') errorAndExit('--storage <path> is required as string')

  const storage = await findCorestore(options)
  await noticeStorage(storage)

  const store = new Corestore(storage)
  const ns = store.namespace(process.hrtime.bigint().toString())
  const drive = new Hyperdrive(ns)
  await drive.ready()

  console.log('New drive:', crayon.magenta(HypercoreId.encode(drive.key)))
}
