#!/usr/bin/env node

const { command, flag, arg, summary, header } = require('paparam')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const goodbye = require('graceful-goodbye')
const { findCorestore, noticeStorage } = require('./lib/find-corestore.js')
const touch = require('./lib/touch.js')
const seed = require('./lib/seed.js')
const mirror = require('./lib/mirror.js')

const touchCmd = command(
  'touch',
  summary('Create a writable Hyperdrive'),
  flag('--storage [path]', 'Storage path'),
  async (cmd) => {
    const storage = findCorestore(cmd.flags.storage)
    await noticeStorage(storage)

    const store = new Corestore(storage)
    goodbye(() => store.close())

    await touch(store)
  }
)

const seedCmd = command(
  'seed',
  summary('Seed a hyperdrive so others can download it'),
  arg('[key]', 'Drive public key'),
  flag('--storage [path]', 'Storage path'),
  flag('--bootstrap [port]', 'Bootstrap port (only relevant for tests)'),
  async (cmd) => {
    const bootstrapPort = cmd.flags.bootstrap
    const bootstrap = bootstrapPort
      ? [{ host: '127.0.0.1', port: parseInt(bootstrapPort, 10) }]
      : null

    const storage = findCorestore(cmd.flags.storage)
    await noticeStorage(storage)

    const store = new Corestore(storage)
    goodbye(() => swarm.destroy())

    const swarm = new Hyperswarm({ bootstrap })
    goodbye(() => store.close())

    await seed(store, swarm, cmd.args.key)
  }
)

const mirrorCmd = command(
  'mirror',
  summary('Mirror a drive into another drive'),
  arg('<src>', 'Source drive (key or path)'),
  arg('<dst>', 'Destination drive (key or path)'),
  flag('--live', 'Enables real-time mirroring'),
  flag('--version [v]', 'Use a specific version'),
  flag('--storage [path]', 'Storage path'),
  flag('--bootstrap [port]', 'Bootstrap port (only relevant for tests)'),
  async (cmd) => {
    const src = cmd.args.src
    const dst = cmd.args.dst
    const bootstrapPort = cmd.flags.bootstrap

    const bootstrap = bootstrapPort
      ? [{ host: '127.0.0.1', port: parseInt(bootstrapPort, 10) }]
      : null

    const storage = findCorestore(cmd.flags.storage)
    await noticeStorage(storage, [src, dst])

    const store = new Corestore(storage)
    goodbye(() => swarm.destroy())

    const swarm = new Hyperswarm({ bootstrap })
    goodbye(() => store.close())

    await mirror(store, swarm, src, dst, {
      live: cmd.flags.live,
      version: cmd.flags.version
    })
  }
)

const cmd = command(
  'drives',
  header('CLI to seed, mirror, and touch a Hyperdrive or Localdrive'),
  touchCmd,
  mirrorCmd,
  seedCmd
)

cmd.parse()
