const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const goodbye = require('graceful-goodbye')
const HypercoreId = require('hypercore-id-encoding')
const crayon = require('tiny-crayon')
const errorAndExit = require('../lib/exit.js')
const { findCorestore, noticeStorage } = require('../lib/find-corestore.js')

module.exports = async function cmd (key, options = {}) {
  if (options.storage && typeof options.storage !== 'string') errorAndExit('--storage <path> is required as string')

  const storage = await findCorestore(options)
  await noticeStorage(storage)

  const swarm = new Hyperswarm()
  const store = new Corestore(storage)
  const drive = new Hyperdrive(store, key ? HypercoreId.decode(key) : null)

  goodbye(() => swarm.destroy(), 1)
  goodbye(() => drive.close(), 2)

  await drive.ready()

  console.log('Key:', crayon.magenta(HypercoreId.encode(drive.key)))
  console.log()

  console.log('Seeding drive...')

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
