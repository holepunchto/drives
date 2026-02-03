const fs = require('fs')
const path = require('path')
const tmpDir = require('test-tmp')
const test = require('brittle')
const { once } = require('events')
const NewlineDecoder = require('newline-decoder')
const { spawnDrivesBin } = require('./helpers.js')

test('touch creates a new drive', async t => {
  const dir = await tmpDir(t)
  const storage = path.join(dir, 'storage')

  const proc = spawnDrivesBin(t, 'touch', '--storage', storage)

  let driveKey = null
  const stdoutDec = new NewlineDecoder('utf-8')

  proc.stdout.on('data', d => {
    for (const line of stdoutDec.push(d)) {
      if (line.includes('New drive:')) {
        driveKey = line.split('New drive: ')[1].slice(0, 52)
      }
    }
  })

  proc.stderr.on('data', d => {
    console.error(d.toString())
    t.fail('stderr output when touching drive')
  })

  const [exitCode] = await once(proc, 'exit')
  t.is(exitCode, 0, '0 exit code when touching drive')
  t.ok(driveKey, 'touch returns a drive key')

  // Check that the directory was created
  const entries = fs.readdirSync(storage)
  t.ok(entries.length > 0, 'storage directory contains files')
})
