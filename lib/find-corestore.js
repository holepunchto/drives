const path = require('path')
const os = require('os')
const crayon = require('tiny-crayon')
const driveType = require('./drive-id.js')
const stat = require('./stat.js')

const homestore = path.join(os.homedir(), '.drives', 'corestore')

module.exports = {
  findCorestore,
  noticeStorage
}

async function findCorestore (options) {
  if (options.storage) return path.resolve(options.storage, 'corestore')

  let dir = './'

  while (true) {
    const dirname = path.resolve(dir, '.drives', 'corestore')
    if (options._cwd || await stat(dirname)) return dirname

    if (dir === '/') break
    dir = path.resolve(dir, '..')
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
