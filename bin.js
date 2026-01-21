#!/usr/bin/env node

const { command, flag, arg, summary, header } = require('paparam')
const touch = require('./bin/touch.js')
const seed = require('./bin/seed.js')
const mirror = require('./bin/mirror.js')

const touchCmd = command(
  'touch',
  summary('Create a writable Hyperdrive'),
  flag('--storage [path]', 'Storage path'),
  touch
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
  mirror
)

const seedCmd = command(
  'seed',
  summary('Seed a Hyperdrive to the DHT network'),
  arg('[key]', 'Drive public key'),
  flag('--storage [path]', 'Storage path'),
  flag('--bootstrap [port]', 'Bootstrap port (only relevant for tests)'),
  seed
)

const cmd = command(
  'drives',
  header('CLI to seed, mirror, and touch a Hyperdrive or Localdrive'),
  touchCmd,
  mirrorCmd,
  seedCmd
)

cmd.parse()
