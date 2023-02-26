const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const HypercoreId = require('hypercore-id-encoding')
const crayon = require('tiny-crayon')
const stat = require('./lib/stat.js')
const errorAndExit = require('./lib/exit.js')

module.exports = async function cmd (options = {}) {
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required as string')
  if (!options.corestore) options.corestore = './corestore'

  if (await stat(options.corestore) === null) console.log(crayon.gray('Notice: creating new corestore dir'))

  const store = new Corestore(options.corestore)
  const ns = store.namespace(process.hrtime.bigint().toString())
  const drive = new Hyperdrive(ns)
  await drive.ready()

  console.log('New drive:', crayon.magenta(HypercoreId.encode(drive.key)))
}
