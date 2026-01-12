const Hyperdrive = require('hyperdrive')
const Hyperswarm = require('hyperswarm')
const HypercoreId = require('hypercore-id-encoding')
const goodbye = require('graceful-goodbye')
const graceful = require('graceful-http')
const crayon = require('tiny-crayon')
const ServeDrive = require('serve-drive')
const errorAndExit = require('../lib/exit.js')
const getDrive = require('../lib/get-drive.js')
const { findCorestore, noticeStorage } = require('../lib/find-corestore.js')

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

  const serve = new ServeDrive({
    port: options.port,
    host: options.host,
    anyPort: !options.disableAnyPort,
    token: options.token !== undefined ? options.token : false,
    get: async ({ key, filename, version }) => {
      // Filter out internal directories
      const lowerFilename = filename.toLowerCase()
      if (lowerFilename.startsWith('/.drives/') || lowerFilename.startsWith('/corestore/')) {
        return null
      }

      // For Hyperdrive, if a key is provided, check if it matches our drive's key
      if (drive instanceof Hyperdrive) {
        if (key !== null && !key.equals(drive.key)) {
          return null
        }
      }

      return drive
    }
  })

  await serve.ready()

  const server = serve.server
  const close = graceful(server)
  goodbye(() => close(), 1)

  console.log('HTTP server on http://' + getHost(server.address().address) + ':' + server.address().port)
}

function getHost (address) {
  if (address === '::' || address === '0.0.0.0') return 'localhost'
  return address
}
