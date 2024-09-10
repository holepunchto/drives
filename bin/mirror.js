const path = require('path')
const { once } = require('events')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const Hyperswarm = require('hyperswarm')
const goodbye = require('graceful-goodbye')
const watchDrive = require('watch-drive')
const crayon = require('tiny-crayon')
const byteSize = require('tiny-byte-size')
const streamEquals = require('binary-stream-equals')
const errorAndExit = require('../lib/exit.js')
const getDrive = require('../lib/get-drive.js')
const swarming = require('../lib/swarming.js')
const generateFilter = require('../lib/generate-filter.js')
const { findCorestore, noticeStorage } = require('../lib/find-corestore.js')

module.exports = async function cmd (src, dst, options = {}) {
  if (options.prefix && typeof options.prefix !== 'string') errorAndExit('--prefix <path> must be a string')
  if (options.storage && typeof options.storage !== 'string') errorAndExit('--storage <path> must be a string')
  if (options.filter && !Array.isArray(options.filter)) errorAndExit('--filter [ignore...] must be an array')

  // For tests, testing on localhost testnet
  const bootstrap = options.bootstrap
    ? [{ host: '127.0.0.1', port: options.bootstrap }]
    : null

  const storage = await findCorestore(options)
  await noticeStorage(storage, [src, dst])

  let source = getDrive(src, storage)
  const destination = getDrive(dst, source.corestore ? source.corestore : storage)

  goodbye(() => source.close(), 3)
  goodbye(() => destination.close(), 3)

  await source.ready()
  await destination.ready()

  if (options.version) {
    const version = parseInt(options.version, 10)
    if (!version) errorAndExit('Invalid --version value')

    const checkout = source.checkout(version)
    goodbye(() => checkout.close(), 3)

    source = checkout
  }

  const hyperdrives = [source, destination].filter(drive => (drive instanceof Hyperdrive))
  if (source instanceof Hyperdrive || (options.live && hyperdrives.length)) {
    const swarm = new Hyperswarm({ bootstrap })
    goodbye(() => swarm.destroy(), 2)

    for (const drive of hyperdrives) swarming(swarm, drive, options)
  }

  if (options.verbose) {
    const sourceType = getDriveType(source)
    console.log(crayon.blue('Source'), crayon.gray('(' + sourceType + ')') + ':', crayon.magenta(getDrivePath(src, sourceType)))

    const destinationType = getDriveType(destination)
    console.log(crayon.green('Target'), crayon.gray('(' + destinationType + ')') + ':', crayon.magenta(getDrivePath(dst, destinationType)))

    console.log()
  }

  if (options.dryRun) {
    console.log(crayon.gray('NOTE: This is a dry run, no changes will be persisted.'))
    console.log()
  }

  let first = true

  const prefix = options.prefix || '/'
  const dryRun = options.dryRun
  const filter = generateFilter(options.filter)

  const mirror = async function () {
    const m = source.mirror(destination, { prefix, filter, dryRun })

    for await (const diff of m) {
      if (options.silent) {
        status(formatDiff(diff), { clear: true })
      } else {
        console.log(formatDiff(diff))
      }
    }

    if (first) {
      first = false

      const version = destination.version ? ' | Version: ' + crayon.yellow(destination.version) : ''

      if (options.silent) {
        status(crayon.green('✔') + ' Total files: ' + crayon.yellow(m.count.files) + ' (' + formatCount(m.count) + ')' + version, { clear: true, done: true })
      } else {
        if (m.count.add || m.count.remove || m.count.change) console.log()
        console.log(crayon.green('✔'), 'Total files:', m.count.files, '(' + formatCount(m.count) + ')' + version)
      }

      if (options.live) console.log()
    }
  }

  let watcher = null
  if (options.live) {
    // No need for teardown logic on the watcher (with goodbye handler)
    // It is fine to just end the program whenever
    watcher = watchDrive(source, prefix, { eagerOpen: true })

    // Note: without eagerOpen this would hang forever
    await once(watcher, 'open')
  }

  await mirror()

  if (!watcher) {
    goodbye.exit()
    return
  }

  for await (const { diff } of watcher) {
    for (const { key } of diff) {
      if (!filter(key)) continue

      const srcEntry = await source.entry(key)
      const tgtEntry = await destination.entry(key)

      if (await same(srcEntry, tgtEntry, source, destination)) continue

      const isDelete = srcEntry === null
      const isNew = tgtEntry === null

      const diffObj = {
        key,
        bytesRemoved: blobLength(tgtEntry),
        bytesAdded: blobLength(srcEntry),
        op: isDelete
          ? 'remove'
          : isNew ? 'add' : 'change'
      }

      if (options.silent) {
        status(formatDiff(diffObj), { clear: true })
      } else {
        console.log(formatDiff(diffObj))
      }

      if (dryRun) continue

      if (isDelete) {
        await destination.del(key)
      } else if (srcEntry.value.linkname) {
        await destination.symlink(key, srcEntry.value.linkname)
      } else {
        await pipeline(
          source.createReadStream(srcEntry),
          destination.createWriteStream(key, { executable: srcEntry.value.executable, metadata: srcEntry.value.metadata })
        )
      }
    }
  }
}

function getDrivePath (arg, type) {
  if (type === 'localdrive') return path.resolve(arg)
  if (type === 'hyperdrive') return arg || 'db'
  errorAndExit('Invalid drive path')
}

function getDriveType (drive) {
  if (drive instanceof Localdrive) return 'localdrive'
  if (drive instanceof Hyperdrive) return 'hyperdrive'
  errorAndExit('Invalid drive')
}

function formatDiff (diff) {
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

  return crayon[color](symbol) + ' ' + crayon[color](diff.key) + ' ' + bytes
}

function formatCount (count) {
  return crayon.green('+' + count.add) + ' ' + crayon.red('-' + count.remove) + ' ' + crayon.yellow('~' + count.change)
}

function status (msg, opts = {}) {
  const clear = '\x1B[2K\x1B[200D'
  process.stdout.write((opts.clear ? clear : '') + msg + (opts.done ? '\n' : ''))
}

function pipeline (rs, ws) {
  return new Promise((resolve, reject) => {
    rs.pipe(ws, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function blobLength (entry) {
  return entry?.value.blob ? entry.value.blob.byteLength : 0
}

// Source: adapted from https://github.com/holepunchto/mirror-drive/blob/037acd7d2566915d43d7dc62b4b30d15522b9df9/index.js#L126-L140
async function same (srcEntry, dstEntry, srcDrive, dstDrive) {
  if (!dstEntry) return false
  if (!srcEntry) return false

  if (srcEntry.value.linkname || dstEntry.value.linkname) {
    return srcEntry.value.linkname === dstEntry.value.linkname
  }

  if (srcEntry.value.executable !== dstEntry.value.executable) return false

  if (!sizeEquals(srcEntry, dstEntry)) return false

  // TODO: consider optimising with metadata, by comparing if supported:
  // if (srcDrive.supportsMetadata && dstDrive.supportsMetadata)...

  return streamEquals(
    srcDrive.createReadStream(srcEntry),
    dstDrive.createReadStream(dstEntry)
  )
}

function sizeEquals (srcEntry, dstEntry) {
  const srcBlob = srcEntry.value.blob
  const dstBlob = dstEntry.value.blob

  if (!srcBlob && !dstBlob) return true
  if (!srcBlob || !dstBlob) return false

  return srcBlob.byteLength === dstBlob.byteLength
}
