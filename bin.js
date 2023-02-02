#!/usr/bin/env node

const { Command } = require('commander')
const touch = require('./touch.js')
const download = require('./download.js')
const seed = require('./seed.js')
const mirror = require('./mirror.js')
const info = require('./info.js')

const program = new Command()

program
  .description('CLI to create, download, seed, and mirror a hyperdrive or localdrive')

program.command('touch')
  .description('Create a writable hyperdrive')
  .option('--corestore <path>', 'Corestore path')
  .action(touch)

program.command('mirror')
  .description('Mirror a drive into another drive')
  .argument('<src>', 'Source drive (key or path)')
  .argument('<dst>', 'Destination drive (key or path)')
  .option('--live', 'Enables real-time sharing')
  .option('--prefix <path>', 'Prefix entries path')
  .option('--filter [ignore...]', 'Ignore entries')
  .option('--corestore <path>', 'Corestore path')
  .action(mirror)

program.command('seed')
  .description('Seed a hyperdrive to the DHT network')
  .argument('[key]', 'Drive public key')
  .option('--corestore <path>', 'Corestore path')
  .action(seed)

program.command('download')
  .description('Download a hyperdrive by key')
  .argument('<key>', 'Drive public key')
  .option('--corestore <path>', 'Corestore path')
  .action(download)

program.command('info')
  .description('Show info about the hyperdrive')
  .argument('[key]', 'Drive public key')
  .option('--corestore <path>', 'Corestore path')
  .action(info)

program.parseAsync()
