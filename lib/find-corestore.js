const path = require('path')
const os = require('os')
const crayon = require('tiny-crayon')
const driveType = require('./drive-id.js')
const stat = require('./stat.js')

const homestore = path.join(os.homedir(), '.drives', 'corestore')
const { root } = path.parse(homestore)

module.exports = {
  findCorestore,
  noticeStorage
}

async function findCorestore (options) {
  if (options.storage) return path.resolve(options.storage, 'corestore')

  let dir = '.'
  let prev = null

  while (true) {
    const dirname = path.resolve(dir, '.drives', 'corestore')
    if (options._cwd || await stat(dirname)) return dirname

    if (dir === '/' || dir === root) break

    prev = dir
    dir = path.resolve(dir, '..')

    if (prev === dir) break // Extra safety in case root check didn't work
  }

  return homestore
}

async function noticeStorage (dirname, list) {
  if (list) {
    const ids = list.map(driveType)
    if (!ids.includes('key')) return
  }

  const exists = await stat(dirname)

  if (exists) console.log(crayon.gray('Storage:', dirname))
  else console.log(crayon.red('Notice:'), crayon.gray('new storage at', dirname))
}
