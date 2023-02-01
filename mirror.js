const path = require('path')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const Hyperswarm = require('hyperswarm')
const HypercoreId = require('hypercore-id-encoding')
const driveId = require('./lib/drive-id')
const goodbye = require('graceful-goodbye')
const debounceify = require('debounceify')
const recursiveWatch = require('recursive-watch')
const crayon = require('tiny-crayon')
const byteSize = require('tiny-byte-size')

module.exports = async function cmd (src, dst, options = {}) {
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required as string')
  if (options.filter && !Array.isArray(options.filter)) errorAndExit('--filter [ignore...] has to be an array')

  if (!options.corestore) options.corestore = './corestore'

  const swarm = new Hyperswarm()
  const source = getDrive(src, options.corestore)
  const destination = getDrive(dst, source.corestore ? source.corestore : options.corestore)

  goodbye(() => swarm.destroy(), 2)
  goodbye(() => source.close(), 3)
  goodbye(() => destination.close(), 3)

  const sourceType = getDriveType(source)
  const destinationType = getDriveType(destination)

  await source.ready()
  await destination.ready()

  const updates = swarming(swarm, [source, destination])
  if (updates.length) console.log(crayon.gray('Swarming drives...'))
  await Promise.all(updates)

  console.log()
  console.log(crayon.blue('Source'), crayon.gray('(' + sourceType + ')') + ':', crayon.magenta(getDrivePath(src, sourceType)))
  console.log(crayon.green('Destination'), crayon.gray('(' + destinationType + ')') + ':', crayon.magenta(getDrivePath(dst, destinationType)))
  console.log()

  /* const isAnyHyperdrive = sourceType === 'hyperdrive' || destinationType === 'hyperdrive'
  if (isAnyHyperdrive) {
    console.log(crayon.gray('Corestore:'), crayon.gray(path.resolve(options.corestore)))
  }

  if (destinationType === 'hyperdrive') {
    console.log(crayon.gray('Hyperdrive key:', HypercoreId.encode(destination.key)))
  }

  console.log() */

  const replicateOnly = sourceType === 'hyperdrive' && destinationType === 'hyperdrive' && !destination.db.feed.writable
  if (replicateOnly) {
    let prev = null
    ontick()

    // + which event to replace the interval?
    const t = setInterval(ontick, 50)
    goodbye(() => clearInterval(t))

    function ontick () {
      if (prev === destination.version) return
      prev = destination.version

      console.log('Source version:', source.version)
      console.log('Destination version:', destination.version)
    }

    return
  }

  let first = true
  const mirror = debounceify(async function () {
    const m = source.mirror(destination, { filter: generateFilter(options.filter) })

    for await (const diff of m) {
      printDiff(diff)
    }

    if (first) {
      first = false
      console.log('First mirror done. Total files:', m.count.files)
      console.log()
    }
  })

  const unwatch = watch(source, mirror)
  goodbye(() => unwatch(), 1)

  await mirror()

  // + goodbye.exit()
  // if (unwatch) unwatch()
  // await swarm.destroy()
  // await source.close()
  // await destination.close()
  // process.exit()
}

function watch (drive, cb) {
  if (drive instanceof Localdrive) {
    return recursiveWatch(drive.root, cb)
  }

  if (drive instanceof Hyperdrive) {
    drive.db.feed.on('append', cb)
    return () => drive.db.feed.off('append', cb)
  }

  errorAndExit('Invalid drive')
}

function swarming (swarm, drives) {
  const updates = []

  for (const drive of drives) {
    if (!(drive instanceof Hyperdrive)) continue

    swarm.on('connection', onsocket)
    swarm.join(drive.discoveryKey) // + server/client depends on src vs dst?

    function onsocket (socket) {
      const remoteInfo = socket.rawStream.remoteHost + ':' + socket.rawStream.remotePort
      const pk = HypercoreId.encode(socket.remotePublicKey)

      // + logs only on opt-in verbose
      console.log(crayon.cyan('(Swarm)'), 'Peer connected', crayon.gray(remoteInfo), crayon.magenta(pk), '(total ' + swarm.connections.size + ')')
      socket.on('close', () => console.log(crayon.cyan('(Swarm)'), 'Peer closed', crayon.gray(remoteInfo), crayon.magenta(pk), '(total ' + swarm.connections.size + ')'))

      drive.corestore.replicate(socket)
    }

    const done = drive.findingPeers()
    swarm.flush().then(done)

    // This is needed so drive.download('/') doesn't get stuck on first run
    if (drive.update) updates.push(drive.update())

    // + just check prev vs current version?
  }

  return updates
}

function getDrivePath (arg, type) {
  if (type === 'localdrive') return path.resolve(arg)
  if (type === 'hyperdrive') return arg || 'db'
  errorAndExit('Invalid drive path')
}

function getDrive (arg, corestore) {
  const id = driveId(arg)

  if (id.type === 'path') {
    return new Localdrive(arg)
  }

  if (id.type === 'key') {
    // + store should be created outside somehow
    // + ram option
    const store = typeof corestore === 'string' ? new Corestore(corestore) : corestore // +
    return new Hyperdrive(store, HypercoreId.decode(arg))
  }

  errorAndExit('Invalid drive')
}

function getDriveType (drive) {
  if (drive instanceof Localdrive) return 'localdrive'
  if (drive instanceof Hyperdrive) return 'hyperdrive'
  errorAndExit('Invalid drive')
}

// + option to disable default filter?
function generateFilter (custom) {
  const ignore = ['.git', '.github', 'package-lock.json', 'node_modules/.package-lock.json', 'corestore']
  if (custom) ignore.push(...custom)

  const str = ignore.map(key => key.replace(/[/.\\\s]/g, '\\$&'))
  const expr = '^\\/(' + str.join('|') + ')(\\/|$)'
  const regex = new RegExp(expr)

  return function filter (key) {
    return regex.test(key) === false
  }
}

function printDiff (diff) {
  const OP_COLORS = { add: 'green', remove: 'red', change: 'yellow' }
  const DIFF_COLORS = { more: 'green', less: 'red', same: 'gray' }
  const SYMBOLS = { add: '+', remove: '-', change: '~' }

  const color = OP_COLORS[diff.op]
  const symbol = SYMBOLS[diff.op]

  let bytes = null
  if (diff.op === 'add') bytes = byteSize(diff.bytesAdded)
  else if (diff.op === 'remove') bytes = byteSize(diff.bytesRemoved)
  else bytes = byteSize(diff.bytesAdded)

  bytes = crayon.cyan(bytes)

  if (diff.op === 'change') {
    const d = diff.bytesAdded - diff.bytesRemoved
    const symbol = d > 0 ? '+' : '' // (d < 0 ? '' : '')
    const type = d > 0 ? 'more' : (d < 0 ? 'less' : 'same')

    const color = DIFF_COLORS[type]
    bytes += ' ' + crayon[color](symbol + byteSize(d))
  }

  console.log(crayon[color](symbol), crayon[color](diff.key), bytes)
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}

// const Seeders = require('@hyperswarm/seeders')

/* const seeders = new Seeders(drive.key, { dht: swarm.dht, maxClientConnections: 16 })
goodbye(() => seeders.destroy(), 1)

if (seeders.owner) throw new Error('Not for owners')

seeders.on('connection', onconnection)
const done2 = drive.findingPeers()
seeders.join().then(done2, done2) */

// + how do I know that I'm on latest?
// because a peer might be replicating an older version, and this CLI will think that it's updated?
