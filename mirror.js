const path = require('path')
const Hyperdrive = require('hyperdrive')
const Localdrive = require('localdrive')
const Hyperswarm = require('hyperswarm')
const goodbye = require('graceful-goodbye')
const debounceify = require('debounceify')
const recursiveWatch = require('recursive-watch')
const crayon = require('tiny-crayon')
const byteSize = require('tiny-byte-size')
const safetyCatch = require('safety-catch')
const errorAndExit = require('./lib/exit.js')
const getDrive = require('./lib/get-drive.js')
const swarming = require('./lib/swarming.js')

module.exports = async function cmd (src, dst, options = {}) {
  if (options.prefix && typeof options.prefix !== 'string') errorAndExit('--prefix <path> must be a string')
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> must be a string')
  if (options.filter && !Array.isArray(options.filter)) errorAndExit('--filter [ignore...] must be an array')

  if (!options.corestore) options.corestore = './corestore'

  const source = getDrive(src, options.corestore)
  const destination = dst ? getDrive(dst, source.corestore ? source.corestore : options.corestore) : null

  const isDownload = !destination
  if (isDownload && !(source instanceof Hyperdrive)) errorAndExit('Source must be a Hyperdrive key for download mode')

  goodbye(() => source.close(), 3)
  if (destination) goodbye(() => destination.close(), 3)

  await source.ready()
  if (destination) await destination.ready()

  const hyperdrives = [source, destination].filter(drive => (drive instanceof Hyperdrive))
  if (source instanceof Hyperdrive || (options.live && hyperdrives.length)) {
    const swarm = new Hyperswarm()
    goodbye(() => swarm.destroy(), 2)

    for (const drive of hyperdrives) swarming(swarm, drive, options)

    if (options.verbose) {
      console.log(crayon.gray('Swarming drives...'))
      console.log()
    }
  }

  if (options.verbose) {
    const sourceType = getDriveType(source)
    console.log(crayon.blue('Source'), crayon.gray('(' + sourceType + ')') + ':', crayon.magenta(getDrivePath(src, sourceType)))

    if (destination) {
      const destinationType = getDriveType(destination)
      console.log(crayon.green('Target'), crayon.gray('(' + destinationType + ')') + ':', crayon.magenta(getDrivePath(dst, destinationType)))
    }

    console.log()
  }

  if (isDownload) {
    console.log(crayon.gray('Downloading drive...'))
    console.log()

    await downloadDrive(source, options)

    return
  }

  let first = true

  const mirror = debounceify(async function () {
    const m = source.mirror(destination, { prefix: options.prefix || '/', filter: generateFilter(options.filter), dryRun: options.dryRun })

    for await (const diff of m) {
      if (options.verbose) {
        console.log(formatDiff(diff))
      } else {
        status(formatDiff(diff), { clear: true })
      }
    }

    if (first) {
      first = false

      if (options.verbose) {
        if (m.count.add || m.count.remove || m.count.change) console.log()
        console.log(crayon.green('✔'), 'Total files:', m.count.files, '(' + formatCount(m.count) + ')')
      } else {
        status(crayon.green('✔') + ' Total files: ' + crayon.yellow(m.count.files) + ' (' + formatCount(m.count) + ')', { clear: true, done: true })
      }

      if (options.live) console.log()
    }
  })

  if (options.live) {
    const unwatch = watch(source, mirror)
    goodbye(() => unwatch(), 1)
  }

  await mirror()

  if (!options.live) goodbye.exit()
}

async function downloadDrive (drive, options) {
  // + live mirror download?

  await drive.update()

  const started = Date.now()

  try {
    await drive.download()
  } catch (err) {
    // Normally a request cancelled due CTRL-C
    safetyCatch(err)
    goodbye.exit()
    return
  }

  console.log('Downloaded in', Date.now() - started, 'ms')

  goodbye.exit()
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

// + option to disable default filter?
function generateFilter (custom) {
  const ignore = ['.git', '.github', 'package-lock.json', 'node_modules/.package-lock.json', 'corestore']
  if (custom) ignore.push(...custom)

  const str = ignore.map(key => key.replace(/[/.\\\s]/g, '\\$&'))
  const expr = '\\/(' + str.join('|') + ')(\\/|$)'
  const regex = new RegExp(expr)

  return function filter (key) {
    return regex.test(key) === false
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
