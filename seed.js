const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const goodbye = require('graceful-goodbye')
const HypercoreId = require('hypercore-id-encoding')

module.exports = async function cmd (key, options = {}) {
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required as string')
  if (!options.corestore) options.corestore = './corestore'

  const swarm = new Hyperswarm()
  const store = new Corestore(options.corestore)
  const drive = new Hyperdrive(store, key ? HypercoreId.decode(key) : null)

  goodbye(() => swarm.destroy(), 1)
  goodbye(() => drive.close(), 2)

  await drive.ready()
  console.log('Replicating drive...')
  console.log('Discovery key:', drive.discoveryKey.toString('hex'))
  console.log('Public key:', HypercoreId.encode(drive.key))

  swarm.on('connection', onconnection)
  swarm.join(drive.discoveryKey, { server: true, client: true })

  swarm.flush().then(() => {
    console.log('(Swarm) Drive is being shared')
  })

  function onconnection (socket) {
    const remoteInfo = socket.rawStream.remoteHost + ':' + socket.rawStream.remotePort
    const pk = HypercoreId.encode(socket.remotePublicKey)

    console.log('(Swarm) Peer connected', remoteInfo, pk, '(total ' + swarm.connections.size + ')')
    socket.on('close', () => console.log('(Swarm) Peer closed', remoteInfo, pk, '(total ' + swarm.connections.size + ')'))

    drive.corestore.replicate(socket) // + how do I replicate only the specific drive? and not the entire store
  }
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
