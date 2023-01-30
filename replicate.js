const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const z32 = require('z32')
const goodbye = require('graceful-goodbye')
const Hyperbee = require('hyperbee')

module.exports = async function cmd (key, options = {}) {
  if (key && options.name) errorAndExit('Can not use both: <drive key> and --name')
  if (!options.corestore || typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required')

  const swarm = new Hyperswarm()
  const store = new Corestore(options.corestore)
  const drive = new Hyperdrive(store, {
    _db: makeBee(parsePublicKey(key), store, options.name) // name overrides key
  })

  goodbye(() => swarm.destroy(), 1)
  goodbye(() => drive.close(), 2)

  await drive.ready()
  console.log('Replicating drive...')
  if (options.name) console.log('Corestore entry name:', options.name)
  console.log('Discovery key:', drive.discoveryKey.toString('hex'))

  swarm.on('connection', onconnection)
  swarm.join(drive.discoveryKey, { server: true, client: true })

  await swarm.flush()
  console.log('Drive is being shared')

  function onconnection (socket) {
    const remoteInfo = socket.rawStream.remoteHost + ':' + socket.rawStream.remotePort

    console.log('Peer connected', remoteInfo)
    socket.on('close', () => console.log('Peer closed', remoteInfo))

    drive.corestore.replicate(socket) // + how do I replicate only the specific drive? and not the entire store
  }
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
