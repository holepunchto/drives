#!/usr/bin/env node

const { Command } = require('commander')
const touch = require('./touch.js')
const download = require('./download.js')
const replicate = require('./replicate.js')
const mirror = require('./mirror.js')
const info = require('./info.js')

const program = new Command()

program
  .description('CLI to create, download, replicate, and mirror a hyperdrive or localdrive')

program.command('touch')
  .description('Create a writable hyperdrive')
  .option('--corestore <path>', 'Corestore path')
  .option('--namespace <ns>', 'Custom namespace')
  .action(touch)

program.command('download')
  .description('Download a hyperdrive by key')
  .argument('<key>', 'Drive public key')
  .option('--corestore <path>', 'Corestore path')
  .option('--localdrive <path>', 'Localdrive path')
  // .option('--ram', '')
  // .option('--node <host:port>', 'Add node')
  .action(download)

program.command('replicate')
  .description('Replicate a hyperdrive to the DHT network')
  .argument('[key]', 'Drive public key')
  .option('--corestore <path>', 'Corestore path')
  .action(replicate)

program.command('mirror')
  .description('Mirror a drive into another drive')
  .argument('<src>', 'Source drive (key or path)')
  .argument('[dst]', 'Destination drive (key or path)')
  .option('--corestore <path>', 'Corestore path')
  .option('--filter [ignore...]', 'Ignore entries')
  .action(mirror)

program.command('info')
  .description('Show info about the hyperdrive')
  .argument('[key]', 'Drive public key')
  .option('--corestore <path>', 'Corestore path')
  .action(info)

program.parseAsync()
