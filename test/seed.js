const path = require('path')
const tmpDir = require('test-tmp')
const test = require('brittle')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const IdEnc = require('hypercore-id-encoding')
const createTestnet = require('hyperdht/testnet')
const Hyperswarm = require('hyperswarm')
const b4a = require('b4a')
const { spawnDrivesBin, waitForOutput } = require('./helpers.js')

test('seed to dht and got mirror from other hyperdrive', async t => {
  // create a hyperdrive and some dummy data
  const srcDir = await tmpDir(t)
  const srcStorage = path.join(srcDir, 'corestore')
  const srcStore = new Corestore(srcStorage)
  const srcDrive = new Hyperdrive(srcStore)
  await srcDrive.ready()
  await srcDrive.put('test-file.txt', b4a.from('Test content'))
  await srcDrive.close()
  await srcStore.close()

  const { bootstrap } = await createTestnet(3, t.teardown)
  const bootstrapPort = bootstrap[0].port

  const seedProc = spawnDrivesBin(t, 'seed', '--storage', srcStorage, '--bootstrap', bootstrapPort, IdEnc.encode(srcDrive.key))

  // Wait for the announcement
  const announced = await waitForOutput(seedProc, 'Announced', 5_000)
  t.ok(announced, 'seed announces to DHT')

  // now create another hyperdrive and replicate from the first one
  const dstDir = await tmpDir(t)
  const dstStore = new Corestore(dstDir)
  t.teardown(() => dstStore.close())
  const dstDrive = new Hyperdrive(dstStore, srcDrive.key)
  t.teardown(() => dstDrive.close())
  await dstDrive.ready()

  const swarm = new Hyperswarm({ bootstrap })
  t.teardown(() => swarm.destroy())
  swarm.on('connection', (conn) => dstDrive.replicate(conn))
  await swarm.join(dstDrive.discoveryKey).flushed()

  // wait for drive to be replicated
  await new Promise(resolve => setTimeout(resolve, 1_000))

  const file = await dstDrive.get('test-file.txt')
  t.is(b4a.toString(file, 'utf8'), 'Test content')
})
