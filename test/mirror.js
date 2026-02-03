const { mkdir, writeFile, readFile } = require('fs/promises')
const path = require('path')
const createTestnet = require('hyperdht/testnet')
const tmpDir = require('test-tmp')
const test = require('brittle')
const NewlineDecoder = require('newline-decoder')
const Corestore = require('corestore')
const Hyperdrive = require('hyperdrive')
const IdEnc = require('hypercore-id-encoding')
const b4a = require('b4a')
const { spawnDrivesBin, setupDrive, waitForOutput } = require('./helpers.js')

test('mirror local to local', async (t) => {
  const dir = await tmpDir(t)

  const srcDir = path.join(dir, 'src')
  await mkdir(srcDir)
  await writeFile(path.join(srcDir, 'test-file.txt'), 'Test content')

  const dstDir = path.join(dir, 'destination')
  await mkdir(dstDir)

  const mirrorProc = spawnDrivesBin(t, 'mirror', srcDir, dstDir)

  mirrorProc.stderr.on('data', (d) => {
    console.error(d.toString())
    t.fail('There should be no stderr in mirror')
  })

  await waitForOutput(mirrorProc, 'Total files: 1')

  // Verify file was mirrored
  await new Promise((resolve) => setTimeout(resolve, 500))
  const fileContent = await readFile(path.join(dstDir, 'test-file.txt'), {
    encoding: 'utf-8'
  })
  t.is(fileContent, 'Test content', 'file content was correctly mirrored')
})

test('mirror --live flow', async (t) => {
  t.comment(
    'One process live mirrors a directory to a hyperdrive, while another process live mirrors that hyperdrive to another directory'
  )

  const { bootstrap } = await createTestnet(3, t.teardown)
  const bootstrapPort = bootstrap[0].port

  const tSetupSource = t.test('source mirror setup')
  tSetupSource.plan(1)
  const tSetupDst = t.test('Destination mirror setup')
  tSetupDst.plan(1)

  const tSourceUpdate = t.test('source mirror updates')
  tSourceUpdate.plan(1)
  const tDstUpdate = t.test('Destination mirror updates')
  tDstUpdate.plan(1)

  const dir = await tmpDir(t)

  const srcDir = path.join(dir, 'src')
  await mkdir(srcDir)
  await writeFile(path.join(srcDir, 'init-file.txt'), 'Just an initial file')
  const dstDir = path.join(dir, 'destination')
  await mkdir(dstDir)

  const srcStorage = path.join(dir, 'src-storage')
  const dstStorage = path.join(dir, 'dst-storage')

  const srcDriveKey = await setupDrive(srcStorage, t)

  const runSrcProc = spawnDrivesBin(
    t,
    'mirror',
    '--live',
    '--storage',
    srcStorage,
    '--bootstrap',
    bootstrapPort,
    srcDir,
    srcDriveKey
  )

  runSrcProc.stderr.on('data', (d) => {
    console.error(d.toString())
    t.fail('There should be no stderr')
  })

  {
    const stdoutDec = new NewlineDecoder('utf-8')
    runSrcProc.stdout.on('data', (d) => {
      for (const line of stdoutDec.push(d)) {
        if (line.includes('Total files: 1')) {
          tSetupSource.pass('Source dir is mirrored')
        }

        if (line.includes('+ /new-file.txt')) {
          tSourceUpdate.pass('Source update detected')
        }
      }
    })
  }

  await tSetupSource

  const runTgtProc = spawnDrivesBin(
    t,
    'mirror',
    '--live',
    '--storage',
    dstStorage,
    '--bootstrap',
    bootstrapPort,
    srcDriveKey,
    dstDir
  )

  runTgtProc.stderr.on('data', (d) => {
    console.error(d.toString())
    t.fail('There should be no stderr')
  })

  {
    const stdoutDec = new NewlineDecoder('utf-8')
    runTgtProc.stdout.on('data', (d) => {
      for (const line of stdoutDec.push(d)) {
        if (line.includes('Total files: 1')) {
          tSetupDst.pass('Setup target mirror')
        }

        if (line.includes('+ /new-file.txt')) {
          tDstUpdate.pass('Target update detected')
        }
      }
    })
  }

  await tSetupDst

  // The file isn't yet guaranteed to be written
  // after the change is logged
  await new Promise((resolve) => setTimeout(resolve, 500))

  {
    const fileContent = await readFile(path.join(dstDir, 'init-file.txt'), {
      encoding: 'utf-8'
    })
    t.is(fileContent, 'Just an initial file', 'correctly mirrored file')
  }

  await writeFile(path.join(srcDir, 'new-file.txt'), 'file added during mirror')

  await tSourceUpdate
  await tDstUpdate

  // The file isn't yet guaranteed to be written
  // after the change is logged
  await new Promise((resolve) => setTimeout(resolve, 500))

  const fileContent = await readFile(path.join(dstDir, 'new-file.txt'), {
    encoding: 'utf-8'
  })
  t.is(fileContent, 'file added during mirror', 'correctly mirrored new file')
})

test('mirror --version checkouts specific version', async (t) => {
  const dir = await tmpDir(t)

  // Create a hyperdrive with multiple versions
  const srcStorage = path.join(dir, 'src-storage', 'corestore')
  const srcStore = new Corestore(srcStorage)
  const srcDrive = new Hyperdrive(srcStore)
  await srcDrive.ready()

  // Version 1: add first file
  await srcDrive.put('/file1.txt', b4a.from('Content v1'))
  const version1 = srcDrive.version

  // Version 2: add second file
  await srcDrive.put('/file2.txt', b4a.from('Content v2'))
  const version2 = srcDrive.version

  t.ok(version2 > version1, 'version increased after adding file')

  const driveKey = IdEnc.encode(srcDrive.key)

  await srcDrive.close()
  await srcStore.close()

  // Mirror at version 1 - should only have file1.txt
  const dstDir1 = path.join(dir, 'dst-v1')
  await mkdir(dstDir1)

  const mirrorProc1 = spawnDrivesBin(
    t,
    'mirror',
    '--storage',
    srcStorage,
    '--version',
    version1,
    driveKey,
    dstDir1
  )

  mirrorProc1.stderr.on('data', (d) => {
    console.error(d.toString())
    t.fail('There should be no stderr in mirror v1')
  })

  await waitForOutput(mirrorProc1, 'Total files: 1')

  // Wait for process to fully exit and release the lock
  await new Promise((resolve) => mirrorProc1.on('exit', resolve))
  await new Promise((resolve) => setTimeout(resolve, 100))

  const file1v1 = await readFile(path.join(dstDir1, 'file1.txt'), 'utf-8')
  t.is(file1v1, 'Content v1', 'file1.txt exists at version 1')

  // file2.txt should not exist at version 1
  try {
    await readFile(path.join(dstDir1, 'file2.txt'), 'utf-8')
    t.fail('file2.txt should not exist at version 1')
  } catch (err) {
    t.is(err.code, 'ENOENT', 'file2.txt does not exist at version 1')
  }

  // Mirror at version 2 - should have both files
  const dstDir2 = path.join(dir, 'dst-v2')
  await mkdir(dstDir2)

  const mirrorProc2 = spawnDrivesBin(
    t,
    'mirror',
    '--storage',
    srcStorage,
    '--version',
    version2,
    driveKey,
    dstDir2
  )

  mirrorProc2.stderr.on('data', (d) => {
    console.error(d.toString())
    t.fail('There should be no stderr in mirror v2')
  })

  await waitForOutput(mirrorProc2, 'Total files: 2')
  await new Promise((resolve) => setTimeout(resolve, 500))

  const file1v2 = await readFile(path.join(dstDir2, 'file1.txt'), 'utf-8')
  t.is(file1v2, 'Content v1', 'file1.txt exists at version 2')

  const file2v2 = await readFile(path.join(dstDir2, 'file2.txt'), 'utf-8')
  t.is(file2v2, 'Content v2', 'file2.txt exists at version 2')
})
