const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const Hyperswarm = require('hyperswarm')
const HypercoreId = require('hypercore-id-encoding')
const driveId = require('./lib/drive-id')
const http = require('http')
const rangeParser = require('range-parser')
const goodbye = require('graceful-goodbye')
const graceful = require('graceful-http')
const crayon = require('tiny-crayon')
const mime = require('mime-types')

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

  const server = http.createServer(async function (req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(400).end()
      return
    }

    const { pathname } = new URL(req.url, 'http://localhost')
    const filename = decodeURI(pathname)
    const entry = await drive.entry(filename)

    if (!entry || !entry.value.blob) {
      res.writeHead(404).end()
      return
    }

    const contentType = mime.lookup(filename)
    res.setHeader('Content-Type', contentType === false ? 'application/octet-stream' : contentType)
    res.setHeader('Accept-Ranges', 'bytes')

    let rs

    if (req.headers.range) {
      const ranges = rangeParser(entry.value.blob.byteLength, req.headers.range)

      if (ranges === -1 || ranges === -2) {
        res.statusCode = 206
        res.setHeader('Content-Length', 0)
        res.end()
        return
      }

      const range = ranges[0]
      const byteLength = range.end - range.start + 1

      res.statusCode = 206
      res.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + entry.value.blob.byteLength)
      res.setHeader('Content-Length', byteLength)

      rs = drive.createReadStream(filename, { start: range.start, length: byteLength })
    } else {
      res.setHeader('Content-Length', entry.value.blob.byteLength)

      rs = drive.createReadStream(filename, { start: 0, length: entry.value.blob.byteLength })
    }

    rs.pipe(res, noop)
  })

  server.listen(options.port, options.host)

  if (!options.disableAnyPort) {
    server.once('error', function (err) {
      if (err.code !== 'EADDRINUSE') throw err
      server.listen(0, options.host)
    })
  }

  const close = graceful(server)
  goodbye(() => close(), 1)

  server.once('listening', function () {
    console.log('HTTP server on http://' + getHost(server.address().address) + ':' + server.address().port)
  })
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

function noop () {}
