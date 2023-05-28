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

module.exports = async function cmd (src, prefix, options = {}) {
  if (options.prefix && typeof options.prefix !== 'string') errorAndExit('--prefix <path> must be a string')
  if (options.storage && typeof options.storage !== 'string') errorAndExit('--storage <path> must be a string')
  if (prefix && options.prefix) errorAndExit('Can not use prefix argument with --prefix option')

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

  prefix = unixResolve('/', prefix || options.prefix)
  const filter = generateFilter()

  try {
    if (!filter(prefix)) return

    for await (const name of drive.readdir(prefix)) {
      const key = unixResolve(prefix, name)
      if (!filter(key)) continue

      const entry = await drive.entry(key)
      console.log(await formatEntry(drive, entry, name))
    }
  } catch (err) {
    // Ignore errors related to CTRL-C: random-access-storage, and Hypercore session
    if (!(err.message === 'Closed' || err.code === 'SESSION_CLOSED' || err.code === 'REQUEST_CANCELLED')) throw err
  } finally {
    goodbye.exit()
  }
}

async function formatEntry (drive, entry, name) {
  const color = await getEntryColor(drive, entry)

  if (entry && entry.value.linkname) {
    const linkname = await drive.entry(entry.value.linkname)
    const linknameColor = linkname ? (await getEntryColor(drive, linkname)) : 'red'

    const from = crayon.bold(name)
    const to = isBold(linkname) ? crayon.bold(entry.value.linkname) : entry.value.linkname

    return applyLinkColor(from, color) + ' -> ' + applyLinkColor(to, linknameColor)
  }

  if (entry && entry.value.blob) {
    const size = byteSize(entry.value.blob.byteLength)
    const key = isBold(entry) ? crayon.bold(name) : name

    return crayon[color](key) + ' ' + crayon.gray('(' + size + ')')
  }

  return crayon[color](crayon.bold(name))
}

async function getEntryColor (drive, entry) {
  if (!entry) {
    return 'blue'
  }

  if (entry.value.linkname) {
    const linkname = await drive.entry(entry.value.linkname)
    return linkname ? 'cyan' : 'red'
  }

  if (entry.value.executable) {
    return 'green'
  }

  return 'white'
}

function isBold (entry) {
  return !entry || entry.value.linkname || entry.value.executable
}

function applyLinkColor (name, color) {
  if (color === 'red') {
    return crayon.inverse(crayon.bgRed(crayon.black(crayon.bold(name))))
  }

  return crayon[color](name)
}
