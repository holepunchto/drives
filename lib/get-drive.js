const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const HypercoreId = require('hypercore-id-encoding')
const driveType = require('./drive-id.js')

module.exports = function getDrive (arg, corestore, options) {
  const type = driveType(arg)

  if (type === 'path') {
    const opts = options ? options.localdrive : {}
    return new Localdrive(arg, opts)
  }

  if (type === 'key') {
    // + store should be created outside somehow
    // + ram option
    const store = typeof corestore === 'string' ? new Corestore(corestore) : corestore // +
    return new Hyperdrive(store, HypercoreId.decode(arg))
  }

  return null
}
