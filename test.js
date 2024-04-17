const { spawn } = require('child_process')
const fsProm = require('fs/promises')
const path = require('path')
const createTestnet = require('hyperdht/testnet')
const tmpDir = require('test-tmp')
const test = require('brittle')
const NewlineDecoder = require('newline-decoder')
const { once } = require('events')

const DEBUG = false
const EXECUTABLE = path.join(__dirname, 'bin.js')

// To force the process.on('exit') to be called on those exits too
process.prependListener('SIGINT', () => process.exit(1))
process.prependListener('SIGTERM', () => process.exit(1))

test('integration: mirror --live flow', async t => {
  t.comment('One process live mirrors a directory to a hyperdrive, while another process live mirrors that hyperdrive to another directory')

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
  await fsProm.mkdir(srcDir)
  await fsProm.writeFile(
    path.join(srcDir, 'init-file.txt'),
    'Just an initial file'
  )
  const dstDir = path.join(dir, 'destination')
  await fsProm.mkdir(dstDir)

  const srcStorage = path.join(dir, 'src-storage')
  const dstStorage = path.join(dir, 'dst-storage')

  const srcDriveKey = await setupDrive(srcStorage, t)

  const runSrcProc = spawn(process.execPath, [
    EXECUTABLE,
    'mirror',
    '--live',
    '--storage',
    srcStorage,
    '--bootstrap',
    bootstrapPort,
    srcDir,
    srcDriveKey

  ])

  // To avoid zombie processes in case there's an error
  process.on('exit', () => {
    runSrcProc.kill('SIGKILL')
  })

  runSrcProc.stderr.on('data', d => {
    console.error(d.toString())
    t.fail('There should be no stderr')
  })

  {
    const stdoutDec = new NewlineDecoder('utf-8')
    runSrcProc.stdout.on('data', d => {
      if (DEBUG) console.log(d.toString())

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

  const runTgtProc = spawn(process.execPath, [
    EXECUTABLE,
    'mirror',
    '--live',
    '--storage',
    dstStorage,
    '--bootstrap',
    bootstrapPort,
    srcDriveKey,
    dstDir
  ])

  // To avoid zombie processes in case there's an error
  process.on('exit', () => {
    if (runTgtProc.exitCode === null) runTgtProc.kill('SIGKILL')
  })

  runTgtProc.stderr.on('data', d => {
    console.error(d.toString())
    t.fail('There should be no stderr')
  })

  {
    const stdoutDec = new NewlineDecoder('utf-8')
    runTgtProc.stdout.on('data', d => {
      if (DEBUG) console.log('<target process>', d.toString())

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
  await new Promise(resolve => setTimeout(resolve, 1000))

  {
    const fileContent = await fsProm.readFile(
      path.join(dstDir, 'init-file.txt'),
      { encoding: 'utf-8' }
    )
    t.is(fileContent, 'Just an initial file', 'correctly mirrored file')
  }

  await fsProm.writeFile(
    path.join(srcDir, 'new-file.txt'),
    'file added during mirror'
  )

  await tSourceUpdate
  await tDstUpdate

  // The file isn't yet guaranteed to be written
  // after the change is logged
  await new Promise(resolve => setTimeout(resolve, 1000))

  {
    const fileContent = await fsProm.readFile(
      path.join(dstDir, 'new-file.txt'),
      { encoding: 'utf-8' }
    )
    t.is(fileContent, 'file added during mirror', 'correctly mirrored new file')
  }

  runSrcProc.kill('SIGKILL')
  runTgtProc.kill('SIGKILL')
})

async function setupDrive (storage, t) {
  const createDriveProc = spawn(EXECUTABLE,
    ['touch', '--storage', storage]
  )

  // To avoid zombie processes in case there's an error
  process.on('exit', () => {
    if (createDriveProc.exitCode === null) createDriveProc.kill('SIGKILL')
  })

  let driveKey = null
  const stdoutDec = new NewlineDecoder('utf-8')

  createDriveProc.stdout.on('data', d => {
    if (DEBUG) console.log('<setup drive stdout>', d.toString())

    for (const line of stdoutDec.push(d)) {
      if (line.includes('New drive:')) {
        driveKey = line.split('New drive: ')[1].slice(0, 64)
      }
    }
  })

  createDriveProc.stderr.on('data', d => {
    console.error(d.toString())
    t.fail('stderr output when touching src drive')
  })

  const [exitCode] = await once(createDriveProc, 'exit')
  t.is(exitCode, 0, '0 exit code when touching drive')
  t.not(driveKey, null, 'Got the drive key')

  return driveKey
}
