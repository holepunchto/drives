const unixResolve = require('unix-path-resolve')
const goodbye = require('graceful-goodbye')
const crayon = require('tiny-crayon')
const errorAndExit = require('../lib/exit.js')
const getDrive = require('../lib/get-drive.js')
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

  filename = unixResolve('/', filename)
  const filter = generateFilter()

  try {
    if (!filter(filename)) return

    if (options.recursive) {
      const batch = drive.batch()
      for await (const entry of drive.list(filename)) {
        await batch.del(entry.key)
      }
      await batch.flush()
    } else {
      await drive.del(filename)
    }

    console.log(crayon.green('File deleted.'))
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
