const Hyperswarm = require('hyperswarm')
const Hyperdrive = require('hyperdrive')
const unixResolve = require('unix-path-resolve')
const goodbye = require('graceful-goodbye')
const crayon = require('tiny-crayon')
const errorAndExit = require('../lib/exit.js')
const getDrive = require('../lib/get-drive.js')
const swarming = require('../lib/swarming.js')
const generateFilter = require('../lib/generate-filter.js')
const { findCorestore, noticeStorage } = require('../lib/find-corestore.js')

module.exports = async function cmd (src, filename, options = {}) {
  if (options.prefix && typeof options.prefix !== 'string') errorAndExit('--prefix <path> must be a string')
  if (options.storage && typeof options.storage !== 'string') errorAndExit('--storage <path> must be a string')

  const storage = await findCorestore(options)
  await noticeStorage(storage, [src])

  const drive = getDrive(src, storage)

  goodbye(() => drive.close())
  await drive.ready()

  if (drive instanceof Hyperdrive) {
    const swarm = new Hyperswarm()
    goodbye(() => swarm.destroy(), 1)

    swarming(swarm, drive, options)
  }

  filename = unixResolve('/', filename)
  const filter = generateFilter()

  try {
    if (!filter(filename)) return

    const blob = await drive.get(filename, { timeout: 15000 })

    if (!blob) {
      console.log(crayon.red('Blob not found.'))
      return
    }

    console.log(blob.toString())
  } catch (err) {
    if (err.code === 'REQUEST_TIMEOUT') {
      console.log(crayon.red('Entry timeout.'))
      return
    }

    // Ignore errors related to CTRL-C: random-access-storage, and Hypercore session
    if (!(err.message === 'Closed' || err.code === 'SESSION_CLOSED' || err.code === 'REQUEST_CANCELLED')) throw err
  } finally {
    goodbye.exit()
  }
}
