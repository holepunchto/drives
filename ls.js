const driveId = require('./lib/drive-id')
const goodbye = require('graceful-goodbye')
const crayon = require('tiny-crayon')
const byteSize = require('tiny-byte-size')
const stat = require('./lib/stat.js')
const errorAndExit = require('./lib/exit.js')
const getDrive = require('./lib/get-drive.js')

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

  const prefix = options.prefix || '/'

  for await (const entry of drive.list(prefix)) {
    // + temp until localdrive readdir is added
    if (entry.key.indexOf('/.git/') > -1) continue
    if (entry.key.indexOf('/.github/') > -1) continue
    if (entry.key.indexOf('/node_modules/') > -1) continue
    if (entry.key.indexOf('/corestore/') > -1) continue

    console.log(await formatEntry(drive, entry))
  }
}

async function formatEntry (drive, entry) {
  const color = await getEntryColor(drive, entry)

  if (entry.value.linkname) {
    const linkname = await drive.entry(entry.value.linkname)
    const linknameColor = linkname ? (await getEntryColor(drive, linkname)) : 'red'

    const from = crayon.bold(entry.key)
    const to = isBold(linkname) ? crayon.bold(entry.value.linkname) : entry.value.linkname

    return applyLinkColor(from, color) + ' -> ' + applyLinkColor(to, linknameColor)
  }

  if (entry.value.blob) {
    const size = byteSize(entry.value.blob.byteLength)
    const name = isBold(entry) ? crayon.bold(entry.key) : entry.key

    return crayon[color](name) + ' ' + crayon.gray('(' + size + ')')
  }

  return crayon[color](entry.key) // +
}

async function getEntryColor (drive, entry) {
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
