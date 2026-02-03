const { spawn } = require('child_process')
const path = require('path')
const NewlineDecoder = require('newline-decoder')
const { once } = require('events')

const EXECUTABLE = path.join(__dirname, '..', 'bin.js')

exports.spawnDrivesBin = (t, ...args) => {
  const proc = spawn(process.execPath, [EXECUTABLE, ...args])
  t.teardown(() => {
    if (proc.exitCode === null) proc.kill('SIGKILL')
  })
  process.on('exit', () => {
    if (proc.exitCode === null) proc.kill('SIGKILL')
  })
  return proc
}

exports.setupDrive = async (storage, t) => {
  const proc = exports.spawnDrivesBin(t, 'touch', '--storage', storage)

  let driveKey = null
  const stdoutDec = new NewlineDecoder('utf-8')

  proc.stdout.on('data', d => {
    for (const line of stdoutDec.push(d)) {
      if (line.includes('New drive:')) {
        driveKey = line.split('New drive: ')[1].slice(0, 52)
      }
    }
  })

  const [exitCode] = await once(proc, 'exit')
  if (exitCode !== 0) {
    throw new Error(`Exit code ${exitCode} when touching drive`)
  }

  return driveKey
}

exports.waitForOutput = async (proc, text, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for "${text}"`))
    }, timeout)

    const stdoutDec = new NewlineDecoder('utf-8')
    proc.stdout.on('data', d => {
      for (const line of stdoutDec.push(d)) {
        if (line.includes(text)) {
          clearTimeout(timer)
          resolve(true)
        }
      }
    })
  })
}
