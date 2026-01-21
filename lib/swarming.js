module.exports = function swarming (swarm, drive) {
  swarm.on('connection', onsocket)
  swarm.join(drive.discoveryKey)

  const done = drive.corestore.findingPeers()
  swarm.flush().then(done, done)

  function onsocket (socket) {
    drive.corestore.replicate(socket)
  }
}
