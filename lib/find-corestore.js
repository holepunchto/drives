const path = require('path')
const os = require('os')
const crayon = require('tiny-crayon')
const driveType = require('./drive-id.js')
const stat = require('./stat.js')

const DEFAULT_STORAGE = path.join(os.homedir(), '.drives', 'corestore')

module.exports = {
  findCorestore,
  noticeStorage
}

function findCorestore (storage) {
  if (storage) return path.resolve(storage)
  return DEFAULT_STORAGE
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
