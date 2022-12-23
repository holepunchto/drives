#!/usr/bin/env node

const { Command } = require('commander')
const download = require('./download.js')
const replicate = require('./replicate.js')
const mirror = require('./mirror.js')
const info = require('./info.js')

const program = new Command()

program
  .description('CLI to download, replicate, and mirror a hyperdrive or localdrive')

program.command('download')
  .description('Download a hyperdrive by key')
  .argument('<key>', 'Drive public key')
  .option('--corestore <path>', 'Corestore path')
  .option('--localdrive <path>', 'Localdrive path')
  .option('--name [value]', 'Hyperdrive name in the corestore')
  // .option('--ram', '')
  // .option('--node <host:port>', 'Add node')
  .action(download)

program.command('replicate')
  .description('Replicate a hyperdrive to the DHT network')
  .argument('[key]', 'Drive public key')
  .option('--corestore <path>', 'Corestore path')
  .option('--name [value]', 'Hyperdrive name in the corestore')
  .action(replicate)

program.command('mirror')
  .description('Mirror a drive into another drive')
  .argument('[key]', 'Drive public key')
  .option('--corestore <path>', 'Corestore path')
  .option('--localdrive <path>', 'Localdrive path')
  .option('--name [value]', 'Hyperdrive name in the corestore')
  .action(mirror)

program.command('info')
  .description('Show info about the hyperdrive')
  .argument('[key]', 'Drive public key')
  .option('--corestore <path>', 'Corestore path')
  .option('--name [value]', 'Hyperdrive name in the corestore')
  .action(info)

program.parseAsync()
