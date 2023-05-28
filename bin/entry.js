const Hyperswarm = require('hyperswarm')
const Hyperdrive = require('hyperdrive')
const unixResolve = require('unix-path-resolve')
const goodbye = require('graceful-goodbye')
const crayon = require('tiny-crayon')
const byteSize = require('tiny-byte-size')
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

    const entry = await drive.entry(filename, { timeout: 15000 })

    if (!entry) {
      console.log(crayon.red('Entry not found.'))
      return
    }

    console.log('Sequence:', crayon.yellow(entry.seq))
    console.log('Key:', crayon.green(entry.key))
    console.log('Executable?', crayon.yellow(entry.value.executable))

    if (entry.value.linkname) console.log('Linkname:', crayon.cyan(entry.value.linkname))
    else console.log(crayon.gray('Linkname: null'))

    if (entry.value.blob) console.log('Blob size:', crayon.yellow(byteSize(entry.value.blob.byteLength)))
    else console.log(crayon.gray('Blob: null'))

    if (entry.value.metadata) console.log('Metadata:', entry.value.metadata)
    else console.log(crayon.gray('Metadata: null'))
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
