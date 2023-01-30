const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const z32 = require('z32')
const HypercoreId = require('hypercore-id-encoding')
const fsp = require('fs/promises')

module.exports = async function cmd (key, options = {}) {
  if (!options.corestore || typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required')
  if (await stat(options.corestore) === null) errorAndExit('--corestore path does not exists')

  const store = new Corestore(options.corestore)
  const drive = new Hyperdrive(store, key ? HypercoreId.decode(key) : null)
  await drive.ready()
  console.log('Loading drive info...')

  console.log('Public key (hex):', drive.key.toString('hex'))
  console.log('Public key (z32):', z32.encode(drive.key))
  console.log('Discovery key:', drive.discoveryKey.toString('hex'))
  console.log('Version:', drive.version) // + why it always says 1?
}

async function stat (path) {
  try {
    return await fsp.stat(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
