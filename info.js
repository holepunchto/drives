const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const z32 = require('z32')
const Hyperbee = require('hyperbee')

module.exports = async function cmd (key, options = {}) {
  if (key && options.name) errorAndExit('Can not use both: <drive key> and --name')
  if (!options.corestore || typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required')

  const store = new Corestore(options.corestore)

  let core = null
  if (key) core = store.get({ key: parsePublicKey(key), cache: true, onwait: null, createIfMissing: false })
  else core = store.get({ name: options.name || 'db', cache: true, onwait: null, createIfMissing: false })

  const _db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json', metadata: { contentFeed: null } })

  const drive = new Hyperdrive(store, { _db })
  await drive.ready()
  console.log('Loading drive info...')

  if (options.name) console.log('Corestore entry name:', options.name)
  console.log('Public key (hex):', drive.key.toString('hex'))
  console.log('Public key (z32):', z32.encode(drive.key))
  console.log('Discovery key:', drive.discoveryKey.toString('hex'))
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
