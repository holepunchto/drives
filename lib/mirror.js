const { once } = require('events')
const Hyperdrive = require('hyperdrive')
const watchDrive = require('watch-drive')
const crayon = require('tiny-crayon')
const byteSize = require('tiny-byte-size')
const streamEquals = require('binary-stream-equals')
const errorAndExit = require('./exit.js')
const getDrive = require('./get-drive.js')

module.exports = async function mirror (store, swarm, src, dst, options = {}) {
  let source = getDrive(src, store)

  const destination = getDrive(dst, source.corestore ? source.corestore : store)

  await source.ready()
  await destination.ready()

  if (options.version) {
    const version = parseInt(options.version, 10)
    if (!version) errorAndExit('Invalid --version value')

    const checkout = source.checkout(version)

    source = checkout
  }

  const hyperdrives = [source, destination].filter(drive => (drive instanceof Hyperdrive))
  if (source instanceof Hyperdrive || (options.live && hyperdrives.length)) {
    for (const drive of hyperdrives) {
      swarm.join(drive.discoveryKey)

      const done = drive.corestore.findingPeers()
      swarm.flush().then(done, done)
    }
  }

  let first = true
  const doMirror = async function () {
    const m = source.mirror(destination, { prefix: '/' })
    for await (const diff of m) console.log(formatDiff(diff))
    if (first) {
      first = false

      const version = destination.version ? ' | Version: ' + crayon.yellow(destination.version) : ''

      if (m.count.add || m.count.remove || m.count.change) console.log()
      console.log(crayon.green('OK'), 'Total files:', m.count.files, '(' + formatCount(m.count) + ')' + version)

      if (options.live) console.log()
    }
  }

  let watcher = null
  if (options.live) {
    // No need for teardown logic on the watcher (with goodbye handler)
    // It is fine to just end the program whenever
    watcher = watchDrive(source, '/', { eagerOpen: true })

    // Note: without eagerOpen this would hang forever
    await once(watcher, 'open')
  }

  await doMirror()

  if (!watcher) {
    return
  }

  for await (const { diff } of watcher) {
    for (const { key } of diff) {
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

      console.log(formatDiff(diffObj))

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
    const symbol = d > 0 ? '+' : ''
    const type = d > 0 ? 'more' : (d < 0 ? 'less' : 'same')

    const color = DIFF_COLORS[type]
    bytes += ' ' + crayon[color](symbol + byteSize(d))
  }

  return crayon[color](symbol) + ' ' + crayon[color](diff.key) + ' ' + bytes
}

function formatCount (count) {
  return crayon.green('+' + count.add) + ' ' + crayon.red('-' + count.remove) + ' ' + crayon.yellow('~' + count.change)
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
