const path = require('path')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const z32 = require('z32')
const Hyperbee = require('hyperbee')

// [the order is important]
// [local to hyper] drives mirror --localdrive <path> --corestore <path>
// [hyper to local] drives mirror --corestore <path> --localdrive <path>
// [hyper to hyper] drives mirror --corestore <path> --corestore <path>
// [local to local] drives mirror --localdrive <path> --localdrive <path>

module.exports = async function cmd (key, options = {}) {
  if (!options.corestore || typeof options.corestore !== 'string') errorAndExit('--corestore <src/dst> is required')
  if (!options.localdrive || typeof options.localdrive !== 'string') errorAndExit('--localdrive <src/dst> is required')

  // + reduce code
  const args = this.parent.args // => [ 'mirror', '--localdrive', 'path1', '--corestore', 'path2' ]

  const from = args[1] // '--localdrive' or '--corestore'
  const src = args[2] // value

  const to = args[3] // '--localdrive' or '--corestore'
  const dst = args[4] // value

  const source = getDrive(from, src, { key, name: options.name })
  const destination = getDrive(to, dst, { key, name: options.name })

  console.log('Mirroring drives...')
  console.log('Source (' + getDriveType(source) + '):', path.resolve(src))
  console.log('Destination (' + getDriveType(destination) + '):', path.resolve(dst))

  const mirror = source.mirror(destination)

  for await (const diff of mirror) {
    console.log(diff.op, diff.key, 'bytesRemoved:', diff.bytesRemoved, 'bytesAdded:', diff.bytesAdded)
    // + try to close exit while mirroring
  }

  console.log('Done', mirror.count)
}

function getDrive (arg, path, { key, name } = {}) {
  if (arg === '--localdrive') {
    return new Localdrive(path)
  } else if (arg === '--corestore') {
    const store = new Corestore(path)
    return new Hyperdrive(store, {
      _db: makeBee(parsePublicKey(key), store, name) // name overrides key
    })
  }
  errorAndExit('Invalid drive')
}

function getDriveType (drive) {
  if (drive instanceof Localdrive) return 'localdrive'
  else if (drive instanceof Hyperdrive) return 'hyperdrive'
  errorAndExit('Invalid drive')
}

function makeBee (key, corestore, name) {
  const metadataOpts = key && !name
    ? { key, cache: true }
    : { name: name || 'db', cache: true }
  const core = corestore.get(metadataOpts)
  const metadata = { contentFeed: null }
  return new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json', metadata })
}

function parsePublicKey (key) {
  if (typeof key === 'string' && key.length === 52) return z32.decode(key)
  if (typeof key === 'string' && key.length === 64) return Buffer.from(key, 'hex')
  return key
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
