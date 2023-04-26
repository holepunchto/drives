const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const goodbye = require('graceful-goodbye')
const HypercoreId = require('hypercore-id-encoding')
const crayon = require('tiny-crayon')
const errorAndExit = require('./lib/exit.js')
const { findCorestore, noticeStorage } = require('./lib/find-corestore.js')

module.exports = async function cmd (key, options = {}) {
  if (options.storage && typeof options.storage !== 'string') errorAndExit('--storage <path> must be a string')

  const storage = await findCorestore(options)
  await noticeStorage(storage)

  const swarm = new Hyperswarm()
  const store = new Corestore(storage)
  const drive = new Hyperdrive(store, key ? HypercoreId.decode(key) : null)

  goodbye(() => swarm.destroy(), 1)
  goodbye(() => drive.close(), 2)

  await drive.ready()

  swarm.on('connection', onsocket)
  swarm.join(drive.discoveryKey, { server: false, client: true })

  const done = drive.corestore.findingPeers()
  swarm.flush().then(done, done)

  await drive.update()

  // + double check if listening to 'blobs' event is needed or not on this case
  if (drive.blobs) downloadCore(drive.blobs.core, 'blobs')
  else drive.once('blobs', (blobs) => downloadCore(blobs.core, 'blobs'))

  downloadCore(drive.core, 'files') // + swarm.join?

  function downloadCore (core, name) {
    onfinish()

    core.download({ linear: true })

    core.on('download', function (index, byteLength, from) {
      // const remoteInfo = from.stream.rawStream.remoteHost + ':' + from.stream.rawStream.remotePort
      console.log('Downloaded ' + name + ' block #' + index, '(' + core.contiguousLength + '/' + core.length + ')')
      onfinish()
    })

    function onfinish () {
      if (core.contiguousLength === core.length) {
        console.log('Download finished for', name)
      }
    }
  }

  function onsocket (socket) {
    const remoteInfo = socket.rawStream.remoteHost + ':' + socket.rawStream.remotePort
    const pk = HypercoreId.encode(socket.remotePublicKey)

    // + logs only on opt-in verbose
    console.log(crayon.cyan('(Swarm)'), 'Peer opened (' + swarm.connections.size + ')', crayon.gray(remoteInfo), crayon.magenta(pk))
    socket.on('close', () => console.log(crayon.cyan('(Swarm)'), 'Peer closed (' + swarm.connections.size + ')', crayon.gray(remoteInfo), crayon.magenta(pk)))

    drive.corestore.replicate(socket)
  }
}
