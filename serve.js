const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const HypercoreId = require('hypercore-id-encoding')
const driveId = require('./lib/drive-id')
const http = require('http')
const rangeParser = require('range-parser')
const goodbye = require('graceful-goodbye')
const graceful = require('graceful-http')

module.exports = async function cmd (src, options = {}) {
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required as string')
  if (!options.corestore) options.corestore = './corestore'

  if (typeof options.port !== 'number') options.port = 5000
  if (typeof options.host !== 'string') options.host = null

  const drive = getDrive(src, options.corestore)

  goodbye(() => drive.close(), 2)
  await drive.ready()

  const server = http.createServer(async function (req, res) {
    if (req.method !== 'GET') {
      res.writeHead(400).end()
      return
    }

    const filename = decodeURI(req.url)
    const entry = await drive.entry(filename)

    if (!entry || !entry.value.blob) {
      res.writeHead(404).end()
      return
    }

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')

    let rs

    if (req.headers.range) {
      const range = rangeParser(entry.value.blob.byteLength, req.headers.range)[0]
      const byteLength = range.end - range.start + 1

      res.statusCode = 206
      res.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + entry.value.blob.byteLength)
      res.setHeader('Content-Length', byteLength)

      rs = drive.createReadStream(filename, { start: range.start, end: byteLength })
    } else {
      res.setHeader('Content-Length', entry.value.blob.byteLength)

      rs = drive.createReadStream(filename, { start: 0, end: entry.value.blob.byteLength })
    }

    rs.pipe(res, noop)
  })

  server.listen(options.port, options.host)

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
