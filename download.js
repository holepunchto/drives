const path = require('path')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const Hyperswarm = require('hyperswarm')
const RAM = require('random-access-memory')
const goodbye = require('graceful-goodbye')
const HypercoreId = require('hypercore-id-encoding')
// const Seeders = require('@hyperswarm/seeders')

module.exports = async function cmd (key, options = {}) {
  if (!key) errorAndExit('<drive key> is required')
  if (!options.corestore && !options.localdrive) errorAndExit('At least one is required: --corestore <path> or --localdrive <folder path>')

  const swarm = new Hyperswarm()

  const store = new Corestore(options.corestore || RAM) // + make a tmp dir instead of ram
  const drive = new Hyperdrive(store, key ? HypercoreId.decode(key) : null)

  goodbye(() => swarm.destroy(), 1)
  goodbye(() => drive.close(), 2)

  await drive.ready()
  console.log('Downloading drive...')

  if (options.corestore) console.log('Corestore path:', path.resolve(options.corestore))
  if (options.localdrive) console.log('Localdrive path:', path.resolve(options.localdrive))
  console.log('Discovery key:', drive.discoveryKey.toString('hex'))
  console.log()

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

  // + how do I know that I'm on latest?
  // because a peer might be replicating an older version, and this CLI will think that it's updated?

  await drive.update() // This is needed so drive.download('/') doesn't get stuck on first run

  // + just check prev vs current version?

  const started = Date.now()
  const dl = drive.download('/') // + or disable sparse?
  // + download progress?

  if (options.localdrive) {
    const out = new Localdrive(options.localdrive)
    const mirror = drive.mirror(out)

    for await (const diff of mirror) {
      // + verbose option, some colors, status
      console.log(diff.op, diff.key, 'bytesRemoved:', diff.bytesRemoved, 'bytesAdded:', diff.bytesAdded)
    }

    // console.log('(Mirror done)')
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
    const pk = HypercoreId.encode(socket.remotePublicKey)

    console.log('(Swarm) Peer connected', remoteInfo, pk, '(total ' + swarm.connections.size + ')')
    socket.on('close', () => console.log('(Swarm) Peer closed', remoteInfo, pk, '(total ' + swarm.connections.size + ')'))

    drive.corestore.replicate(socket)
  }
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
