const path = require('path')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const HypercoreId = require('hypercore-id-encoding')

module.exports = async function cmd (key, options = {}) {
  if (!options.corestore || typeof options.corestore !== 'string') errorAndExit('--corestore <src/dst> is required')
  if (!options.localdrive || typeof options.localdrive !== 'string') errorAndExit('--localdrive <src/dst> is required')
  if (options.filter && !Array.isArray(options.filter)) errorAndExit('--filter [ignore...] has to be an array')

  // + reduce code
  const args = this.parent.args // => [ 'mirror', '--localdrive', 'path1', '--corestore', 'path2' ]
  const pos = key ? 1 : 0

  const from = args[1 + pos] // '--localdrive' or '--corestore'
  const src = args[2 + pos] // value

  const to = args[3 + pos] // '--localdrive' or '--corestore'
  const dst = args[4 + pos] // value

  const source = getDrive(from, src, key)
  const destination = getDrive(to, dst, key)

  console.log('Mirroring drives...')
  console.log('Source (' + getDriveType(source) + '):', path.resolve(src))
  console.log('Destination (' + getDriveType(destination) + '):', path.resolve(dst))
  console.log()

  const ignore = ['.git', '.github', 'package-lock.json', 'node_modules/.package-lock.json']
  if (options.filter) ignore.push(...options.filter)
  const str = ignore.map(key => key.replace(/[/.\\\s]/g, '\\$&'))
  const expr = '^\\/(' + str.join('|') + ')(\\/|$)'
  const regex = new RegExp(expr)

  const mirror = source.mirror(destination, { filter: (key) => regex.test(key) === false })

  for await (const diff of mirror) {
    console.log(diff.op, diff.key, 'bytesRemoved:', diff.bytesRemoved, 'bytesAdded:', diff.bytesAdded)
    // + try to close exit while mirroring
  }

  console.log('Done', mirror.count)
}

function getDrive (arg, path, key) {
  if (arg === '--localdrive') {
    return new Localdrive(path)
  }

  if (arg === '--corestore') {
    const store = new Corestore(path)
    return new Hyperdrive(store, key ? HypercoreId.decode(key) : null)
  }

  errorAndExit('Invalid drive')
}

function getDriveType (drive) {
  if (drive instanceof Localdrive) return 'localdrive'
  if (drive instanceof Hyperdrive) return 'hyperdrive'
  errorAndExit('Invalid drive')
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
