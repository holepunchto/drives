const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const HypercoreId = require('hypercore-id-encoding')
const http = require('http')
const goodbye = require('graceful-goodbye')
const graceful = require('graceful-http')
const crayon = require('tiny-crayon')
const ServeDrive = require('serve-drive')
const errorAndExit = require('./lib/exit.js')
const getDrive = require('./lib/get-drive.js')
const { findCorestore, noticeStorage } = require('./lib/find-corestore.js')

module.exports = async function cmd (src, options = {}) {
  if (options.storage && typeof options.storage !== 'string') errorAndExit('--storage <path> is required as string')

  const storage = await findCorestore(options)
  await noticeStorage(storage, [src])

  options.port = typeof options.port !== 'undefined' ? Number(options.port) : 7000
  options.host = typeof options.host !== 'undefined' ? options.host : null

  const drive = getDrive(src, storage, { localdrive: { followLinks: true } })

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

  const serve = new ServeDrive({
    port: options.port,
    host: options.host,
    anyPort: !options.disableAnyPort,
    server,
    filter: (id, filename) => {
      // TODO: remove "corestore" at some point
      filename = filename.toLowerCase()
      return !(filename.startsWith('/.drives/') || filename.startsWith('/corestore/'))
    }
  })

  serve.add(drive, { default: true })
  await serve.ready()

  goodbye(() => close(), 1)

  console.log('HTTP server on http://' + getHost(server.address().address) + ':' + server.address().port)
}

function getHost (address) {
  if (address === '::' || address === '0.0.0.0') return 'localhost'
  return address
}
