
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const HypercoreId = require('hypercore-id-encoding')
const errorAndExit = require('../lib/exit.js')
const { findCorestore, noticeStorage } = require('../lib/find-corestore.js')
const fs = require('fs').promises

module.exports = async function cmd(options = {}) {
  if (options.storage && typeof options.storage !== 'string') errorAndExit('--storage <path> is required as string')

  const storage = await findCorestore(options)
  await noticeStorage(storage)

  try {
  console.log((await fs.readFile(storage + '/../drives', 'utf8')).trimEnd())
  } catch (error) {
    // if file doesn't exist (ENOENT) there are no drives present in the storage
    // anyother error is more serious
    if (error.code != 'ENOENT') throw error
  }
}
