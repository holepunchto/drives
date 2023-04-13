const HypercoreId = require('hypercore-id-encoding')
const crayon = require('tiny-crayon')

module.exports = function swarming (swarm, drive, options) {
  swarm.on('connection', onsocket)
  swarm.join(drive.discoveryKey)

  const done = drive.corestore.findingPeers()
  swarm.flush().then(done, done)

  function onsocket (socket) {
    const remoteInfo = socket.rawStream.remoteHost + ':' + socket.rawStream.remotePort
    const id = HypercoreId.encode(socket.remotePublicKey)

    if (options.verbose) {
      console.log(crayon.cyan('(Swarm)'), 'Peer opened (' + swarm.connections.size + ')', crayon.gray(remoteInfo), crayon.magenta(id))
      socket.on('close', () => console.log(crayon.cyan('(Swarm)'), 'Peer closed (' + swarm.connections.size + ')', crayon.gray(remoteInfo), crayon.magenta(id)))
    }

    drive.corestore.replicate(socket)
  }
}
