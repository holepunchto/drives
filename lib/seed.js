const Hyperdrive = require('hyperdrive')
const goodbye = require('graceful-goodbye')
const HypercoreId = require('hypercore-id-encoding')
const ansiDiff = require('ansi-diff')
const crayon = require('tiny-crayon')

module.exports = async function seed (store, swarm, key) {
  const drive = new Hyperdrive(store, key ? HypercoreId.decode(key) : null)
  goodbye(() => drive.close())

  await drive.ready()

  const diff = ansiDiff()
  const state = {
    announced: false
  }

  swarm.on('connection', (socket) => drive.replicate(socket))
  const discovery = swarm.join(drive.discoveryKey)

  discovery.flushed().then(() => {
    state.announced = true
    onpeertick(diff, drive, state)
  })

  oncore(diff, drive, drive.core, state)

  if (drive.blobs) oncore(diff, drive, drive.blobs.core, state)
  else drive.once('blobs', blobs => oncore(diff, drive, blobs.core, state))

  // TODO: We need a 'peer-update' event in Hypercore
  const intervalId = setInterval(() => onpeertick(diff, drive, state), 1000)
  goodbye(() => clearInterval(intervalId))
}

function oncore (diff, drive, core, state) {
  core.on('peer-add', onpeertick.bind(null, diff, drive, state))
  core.on('peer-remove', onpeertick.bind(null, diff, drive, state))
  onpeertick(diff, drive, state)
}

function onpeertick (diff, drive, state = {}) {
  const peers = new Map() // Recreating it every time simplifies things

  for (const peer of drive.core.peers) onpeer(peer, 'core')
  for (const peer of drive.blobs?.core.peers || []) onpeer(peer, 'blobs')

  update(diff, render)

  function onpeer (peer, type) {
    const id = HypercoreId.encode(peer.remotePublicKey)

    const existing = peers.get(id)
    const info = existing || {
      core: { peer: null },
      blobs: { peer: null }
    }

    if (type === 'core') info.core.peer = peer
    else info.blobs.peer = peer

    if (!existing) peers.set(id, info)
  }

  function render () {
    return [
      `
        ${state.announced ? crayon.cyan('Announced') : crayon.red('Announcing...')}
        Files: ${crayon.green(drive.id)}
        ${drive.contentKey ? `Blobs: ${crayon.green(HypercoreId.encode(drive.contentKey))}` : ''}
      `,

      onpeers()
    ]
  }

  function onpeers () {
    if (peers.size === 0) return crayon.red('No peers')

    const output = ['Peers']
    let count = 0

    for (const [id, info] of peers) {
      const key = id.slice(0, 5) + '..' + id.slice(-5)
      const remoteInfo = info.core.peer?.stream.rawStream.remoteHost

      output.push(
        '- ' +
        (remoteInfo ? crayon.gray(remoteInfo) + ' ' : '') +
        crayon.magenta(key) + ' ' +
        crayon.yellow((info.core.peer?.remoteContiguousLength || 0) + '/' + drive.core.length) + ' + ' +
        crayon.yellow((info.blobs.peer?.remoteContiguousLength || 0) + '/' + (drive.blobs?.core.length || 0)) + ' blks'
      )

      if (++count === 5) break
    }

    if (peers.size - count > 0) output.push('... and ' + crayon.yellow(peers.size - count) + ' more connections')

    return output.join('\n')
  }
}

// TODO: This could end up being a small lib for a simple rendering solution?
function update (diff, render) {
  const original = render()
  const blocks = Array.isArray(original) ? original : [original]
  const processed = []

  for (let block of blocks) {
    if (block === null) continue

    block = block.replace(/  +/g, ' ') // Remove double spaces
    // block = block.replace(/(\s\s)+/g, '$1') // Remove double spaces
    block = block.replace(/^ +/gm, '') // Remove identation
    block = block.trim()

    processed.push(block)
  }

  process.stdout.write(diff.update(processed.join('\n\n') + '\n'))
}
