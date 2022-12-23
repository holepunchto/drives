const path = require('path')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const Hyperswarm = require('hyperswarm')
const RAM = require('random-access-memory')
const z32 = require('z32')
const goodbye = require('graceful-goodbye')
const Hyperbee = require('hyperbee')
// const Seeders = require('@hyperswarm/seeders')

module.exports = async function cmd (key, options = {}) {
  if (!key) errorAndExit('<drive key> is required')
  if (!options.corestore && !options.localdrive) errorAndExit('At least one is required: --corestore <path> or --localdrive <folder path>')

  const swarm = new Hyperswarm()

  const store = new Corestore(options.corestore || RAM) // + make a tmp dir instead of ram

  let core = null
  if (key) core = store.get({ key: parsePublicKey(key), cache: true, onwait: null })
  else core = store.get({ name: options.name || 'db', cache: true, onwait: null })

  const _db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json', metadata: { contentFeed: null } })

  const drive = new Hyperdrive(store, { _db })

  goodbye(() => swarm.destroy(), 1)
  goodbye(() => drive.close(), 2)

  await drive.ready()
  console.log('Downloading drive...')

  if (options.corestore) console.log('Corestore path:', path.resolve(options.corestore))
  if (options.localdrive) console.log('Localdrive path:', path.resolve(options.localdrive))
  if (options.name) console.log('Corestore entry name:', options.name)
  console.log('Discovery key:', drive.discoveryKey.toString('hex'))

  swarm.on('connection', onconnection)
  swarm.join(drive.discoveryKey, { server: false, client: true })

  const done = drive.findingPeers()
  swarm.flush().then(done)

  /* const seeders = new Seeders(drive.key, { dht: swarm.dht, maxClientConnections: 16 })
  goodbye(() => seeders.destroy(), 1)
  
  if (seeders.owner) throw new Error('Not for owners')

  seeders.on('connection', onconnection)
  const done2 = drive.findingPeers()
  seeders.join().then(done2, done2) */

  // const updated = await drive.update()
  // console.log('Updated?', updated)

  const started = Date.now()
  const dl = drive.download('/') // + or disable sparse?
  // + download progress?

  if (options.localdrive) {
    const out = new Localdrive(options.localdrive)
    const mirror = drive.mirror(out)

    for await (const diff of mirror) {
      console.log(diff.op, diff.key, 'bytesRemoved:', diff.bytesRemoved, 'bytesAdded:', diff.bytesAdded)
    }

    await dl // + just in case?

    console.log('Done in', Date.now() - started, 'ms', mirror.count)
  } else {
    await dl
    console.log('Done in', Date.now() - started, 'ms')
  }

  // goodbye.exit()
  await swarm.destroy()
  await drive.close()
  process.exit()

  function onconnection (socket) {
    const remoteInfo = socket.rawStream.remoteHost + ':' + socket.rawStream.remotePort

    console.log('Peer connected', remoteInfo)
    socket.on('close', () => console.log('Peer closed', remoteInfo))

    drive.corestore.replicate(socket) // + is this exposing anything besides the specific drive?
  }
}

// + make hyperdrive to support passing opts.name which overrides key
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
