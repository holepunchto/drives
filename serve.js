const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const Hyperswarm = require('hyperswarm')
const HypercoreId = require('hypercore-id-encoding')
const driveId = require('./lib/drive-id')
const http = require('http')
const goodbye = require('graceful-goodbye')
const graceful = require('graceful-http')
const crayon = require('tiny-crayon')
const serve = require('serve-drive')

module.exports = async function cmd (src, options = {}) {
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required as string')
  if (!options.corestore) options.corestore = './corestore'

  options.port = typeof options.port !== 'undefined' ? Number(options.port) : 7000
  options.host = typeof options.host !== 'undefined' ? options.host : null

  const drive = getDrive(src, options.corestore)

  goodbye(() => drive.close(), 2)
  await drive.ready()

  if (drive instanceof Hyperdrive) {
    const swarm = new Hyperswarm()
    goodbye(() => swarm.destroy(), 3)

    swarm.on('connection', onsocket)
    swarm.join(drive.discoveryKey)

    function onsocket (socket) {
      const remoteInfo = socket.rawStream.remoteHost + ':' + socket.rawStream.remotePort
      const pk = HypercoreId.encode(socket.remotePublicKey)

      if (options.verbose) {
        console.log(crayon.cyan('(Swarm)'), 'Peer opened (' + swarm.connections.size + ')', crayon.gray(remoteInfo), crayon.magenta(pk))
        socket.on('close', () => console.log(crayon.cyan('(Swarm)'), 'Peer closed (' + swarm.connections.size + ')', crayon.gray(remoteInfo), crayon.magenta(pk)))
      }

      drive.corestore.replicate(socket)
    }

    const done = drive.corestore.findingPeers()
    swarm.flush().then(done, done)
  }

  const server = http.createServer()
  const close = graceful(server)

  await serve(drive, {
    port: options.port,
    host: options.host,
    anyPort: !options.disableAnyPort,
    server
  })

  goodbye(() => close(), 1)

  console.log('HTTP server on http://' + getHost(server.address().address) + ':' + server.address().port)
}

function getHost (address) {
  if (address === '::' || address === '0.0.0.0') return 'localhost'
  return address
}

function getDrive (arg, corestore) {
  const id = driveId(arg)

  if (id.type === 'path') {
    return new Localdrive(arg, { followLinks: true })
  }

  if (id.type === 'key') {
    const store = new Corestore(corestore)
    return new Hyperdrive(store, HypercoreId.decode(arg))
  }

  errorAndExit('Invalid drive')
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
