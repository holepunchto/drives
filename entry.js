const Hyperswarm = require('hyperswarm')
const Hyperdrive = require('hyperdrive')
const goodbye = require('graceful-goodbye')
const crayon = require('tiny-crayon')
const byteSize = require('tiny-byte-size')
const errorAndExit = require('./lib/exit.js')
const getDrive = require('./lib/get-drive.js')
const swarming = require('./lib/swarming.js')

module.exports = async function cmd (src, filename, options = {}) {
  if (options.prefix && typeof options.prefix !== 'string') errorAndExit('--prefix <path> must be a string')
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> must be a string')
  if (!options.corestore) options.corestore = './corestore'

  const drive = getDrive(src, options.corestore)

  goodbye(() => drive.close())
  await drive.ready()

  if (drive instanceof Hyperdrive) {
    const swarm = new Hyperswarm()
    goodbye(() => swarm.destroy(), 1)

    swarming(swarm, drive, options)
  }

  try {
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

    if (entry.value.blob) console.log('Blob length:', crayon.yellow(entry.value.blob.byteLength))
    else console.log(crayon.gray('Blob: null'))

    if (entry.value.metadata) console.log('Metadata:', entry.value.metadata)
    else console.log(crayon.gray('Metadata: null'))
  } catch (err) {
    if (err.code === 'REQUEST_TIMEOUT') {
      console.log(crayon.red('Entry timeout.'))
      return
    }

    // Ignore errors related to CTRL-C: random-access-storage, and Hypercore session
    if (!(err.message === 'Closed' || err.code === 'SESSION_CLOSED')) throw err
  } finally {
    goodbye.exit()
  }
}
