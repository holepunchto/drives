const Corestore = require('corestore')
const { findCorestore, noticeStorage } = require('../lib/find-corestore.js')

module.exports = async function cmd (options = {}) {
  const storage = await findCorestore({ _cwd: true })
  await noticeStorage(storage)

  const store = new Corestore(storage)
  await store.ready()
}
