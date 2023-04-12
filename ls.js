const Hyperswarm = require('hyperswarm')
const Hyperdrive = require('hyperdrive')
const goodbye = require('graceful-goodbye')
const crayon = require('tiny-crayon')
const byteSize = require('tiny-byte-size')
const driveId = require('./lib/drive-id')
const stat = require('./lib/stat.js')
const errorAndExit = require('./lib/exit.js')
const getDrive = require('./lib/get-drive.js')
const swarming = require('./lib/swarming.js')

module.exports = async function cmd (src, options = {}) {
  if (options.prefix && typeof options.prefix !== 'string') errorAndExit('--prefix <path> must be a string')
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> must be a string')
  if (!options.corestore) options.corestore = './corestore'

  const id = driveId(src)

  if (id.type === 'key') {
    if (await stat(options.corestore) === null) errorAndExit('--corestore path does not exists')
  }

  const drive = getDrive(src, options.corestore)

  goodbye(() => drive.close())
  await drive.ready()

  if (drive instanceof Hyperdrive) {
    const swarm = new Hyperswarm()
    goodbye(() => swarm.destroy(), 1)

    swarming(swarm, drive, options)
  }

  const prefix = options.prefix || '/'

  for await (const name of drive.readdir(prefix)) {
    const key = require('path').join(prefix, name)
    const entry = await drive.entry(key)
    console.log(await formatEntry(drive, entry, name))
  }

  goodbye.exit()
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
