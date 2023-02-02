const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const goodbye = require('graceful-goodbye')
const HypercoreId = require('hypercore-id-encoding')
const crayon = require('tiny-crayon')

module.exports = async function cmd (key, options = {}) {
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required as string')
  if (!options.corestore) options.corestore = './corestore'

  const swarm = new Hyperswarm()
  const store = new Corestore(options.corestore)
  const drive = new Hyperdrive(store, key ? HypercoreId.decode(key) : null)

  goodbye(() => swarm.destroy(), 1)
  goodbye(() => drive.close(), 2)

  await drive.ready()

  console.log(crayon.gray('Seeding drive...'))
  console.log('Key:', crayon.magenta(HypercoreId.encode(drive.key)))
  console.log()

  swarm.on('connection', onsocket)
  const discovery = swarm.join(drive.discoveryKey)

  await discovery.flushed()
  console.log(crayon.cyan('(Swarm)'), 'Drive is being shared')

  function onsocket (socket) {
    const remoteInfo = socket.rawStream.remoteHost + ':' + socket.rawStream.remotePort
    const pk = HypercoreId.encode(socket.remotePublicKey)

    console.log(crayon.cyan('(Swarm)'), 'Peer opened (' + swarm.connections.size + ')', crayon.gray(remoteInfo), crayon.magenta(pk))
    socket.on('close', () => console.log(crayon.cyan('(Swarm)'), 'Peer closed (' + swarm.connections.size + ')', crayon.gray(remoteInfo), crayon.magenta(pk)))

    drive.corestore.replicate(socket)
  }
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
