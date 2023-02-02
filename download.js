const path = require('path')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const Hyperswarm = require('hyperswarm')
const RAM = require('random-access-memory')
const goodbye = require('graceful-goodbye')
const HypercoreId = require('hypercore-id-encoding')
// const Seeders = require('@hyperswarm/seeders')
const crayon = require('tiny-crayon')

module.exports = async function cmd (key, options = {}) {
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> must be a string')
  if (!options.corestore) options.corestore = './corestore'

  const swarm = new Hyperswarm()
  const store = new Corestore(options.corestore)
  const drive = new Hyperdrive(store, key ? HypercoreId.decode(key) : null)

  goodbye(() => swarm.destroy(), 1)
  goodbye(() => drive.close(), 2)

  await drive.ready()
  console.log(crayon.gray('Downloading drive...'))
  console.log('Key:', crayon.magenta(HypercoreId.encode(drive.key)))
  console.log()

  swarm.on('connection', onsocket)
  swarm.join(drive.discoveryKey, { server: false, client: true })

  const done = drive.corestore.findingPeers()
  swarm.flush().then(done, done)

  /* const seeders = new Seeders(drive.key, { dht: swarm.dht, maxClientConnections: 8 })
  goodbye(() => seeders.destroy(), 1)

  if (seeders.owner) throw new Error('Not for owners')

  seeders.on('connection', onsocket)
  const done2 = drive.corestore.findingPeers()
  seeders.join().then(done2, done2) */

  await drive.update() // This is needed so drive.download('/') doesn't get stuck on first run

  // + just check prev vs current version?

  const started = Date.now()
  await drive.download('/') // + or disable sparse?
  console.log('Downloaded in', Date.now() - started, 'ms')

  goodbye.exit()

  function onsocket (socket) {
    const remoteInfo = socket.rawStream.remoteHost + ':' + socket.rawStream.remotePort
    const pk = HypercoreId.encode(socket.remotePublicKey)

    // + logs only on opt-in verbose
    console.log(crayon.cyan('(Swarm)'), 'Peer opened (' + swarm.connections.size + ')', crayon.gray(remoteInfo), crayon.magenta(pk))
    socket.on('close', () => console.log(crayon.cyan('(Swarm)'), 'Peer closed (' + swarm.connections.size + ')', crayon.gray(remoteInfo), crayon.magenta(pk)))

    drive.corestore.replicate(socket)
  }
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
