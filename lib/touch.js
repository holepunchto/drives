const Hyperdrive = require('hyperdrive')
const HypercoreId = require('hypercore-id-encoding')
const crayon = require('tiny-crayon')

module.exports = async function touch (store) {
  const ns = store.namespace(process.hrtime.bigint().toString())
  const drive = new Hyperdrive(ns)

  await drive.ready()

  console.log('New drive:', crayon.magenta(HypercoreId.encode(drive.key)))
}
