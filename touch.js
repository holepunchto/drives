const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const HypercoreId = require('hypercore-id-encoding')
const fsp = require('fs/promises')
const crayon = require('tiny-crayon')

module.exports = async function cmd (options = {}) {
  if (options.corestore && typeof options.corestore !== 'string') errorAndExit('--corestore <path> is required as string')
  if (!options.corestore) options.corestore = './corestore'

  if (await stat(options.corestore) === null) console.log('Notice: creating new corestore dir')

  const store = new Corestore(options.corestore)
  const ns = store.namespace(process.hrtime.bigint().toString())
  const drive = new Hyperdrive(ns)
  await drive.ready()

  console.log('New drive:', crayon.magenta(HypercoreId.encode(drive.key)))
}

async function stat (path) {
  try {
    return await fsp.stat(path)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function errorAndExit (message) {
  console.error('Error:', message)
  process.exit(1)
}
