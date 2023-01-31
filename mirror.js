const path = require('path')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const HypercoreId = require('hypercore-id-encoding')
const driveId = require('./drive-id')

module.exports = async function cmd (src, dst, options = {}) {
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required as string')
  if (options.filter && !Array.isArray(options.filter)) errorAndExit('--filter [ignore...] has to be an array')

  if (!options.corestore) options.corestore = './corestore'

  const source = getDrive(src, options.corestore)
  const destination = getDrive(dst, options.corestore)

  const sourceType = getDriveType(source)
  const destinationType = getDriveType(destination)

  await source.ready()
  await destination.ready()

  console.log('Mirroring drives...')
  console.log('Source (' + sourceType + '):', sourceType === 'localdrive' ? path.resolve(src) : (src || 'db (default)'))
  console.log('Destination (' + destinationType + '):', destinationType === 'localdrive' ? path.resolve(dst) : (dst || 'db (default)'))
  if (sourceType === 'hyperdrive' || destinationType === 'hyperdrive') console.log('Corestore:', path.resolve(options.corestore))
  if (destinationType === 'hyperdrive') console.log('Hyperdrive key:', HypercoreId.encode(destination.key))
  console.log()

  const mirror = source.mirror(destination, { filter: generateFilter(options.filter) })

  for await (const diff of mirror) {
    console.log(diff.op, diff.key, 'bytesRemoved:', diff.bytesRemoved, 'bytesAdded:', diff.bytesAdded)
    // + try to close exit while mirroring
  }

  console.log('Done', mirror.count)
}

function getDrive (arg, corestore) {
  const id = driveId(arg)

  if (id.type === 'path') {
    return new Localdrive(arg)
  }

  if (id.type === 'key') {
    const store = new Corestore(corestore)
    return new Hyperdrive(store, arg ? HypercoreId.decode(arg) : null)
  }

  errorAndExit('Invalid drive')
}

function getDriveType (drive) {
  if (drive instanceof Localdrive) return 'localdrive'
  if (drive instanceof Hyperdrive) return 'hyperdrive'
  errorAndExit('Invalid drive')
}

function generateFilter (custom) {
  const ignore = ['.git', '.github', 'package-lock.json', 'node_modules/.package-lock.json', 'corestore']
  if (custom) ignore.push(...custom)

  const str = ignore.map(key => key.replace(/[/.\\\s]/g, '\\$&'))
  const expr = '^\\/(' + str.join('|') + ')(\\/|$)'
  const regex = new RegExp(expr)

  return function filter (key) {
    return regex.test(key) === false
  }
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
