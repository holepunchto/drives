# drives

CLI to seed, mirror, and serve a Hyperdrive or Localdrive

```
npm i -g drives
```

## Usage
```bash
Usage: drives [options] [command]

Commands:
  init                          Initializes a new storage on the cwd
  touch [options]               Create a writable Hyperdrive
  mirror [options] <src> [dst]  Mirror a drive into another drive
  ls [options] <src> [path]     List files of the drive
  seed [options] [key]          Seed a Hyperdrive to the DHT network
  download [options] <key>      Archive download a Hyperdrive by key
  serve [options] <src>         Creates a HTTP drive server
  entry [options] <src> <path>  Show a single entry file
  info [options] [key]          Show info about the Hyperdrive
  help [command]                display help for command
```

## API
Use `drives --help` for more information, `drives mirror --help`, etc.

#### Storage

By default, it tries to use `.drives` from the current directory.

If it doesn't exists then it will go back `../` until it finds an existing `.drives`.

If it doesn't find anything, then it will create and use a global folder at `~/.drives`.

You can always set `--storage [path]` to force a different location.

#### Initialize
It creates the `.drives` storage folder in the current working directory.

```bash
drives init
# Notice: new storage at /home/user/Desktop/my-project/.drives/corestore
```

Useful to avoid doing a parent lookup, and not using the home folder.

#### Create a writable Hyperdrive
```bash
drives touch
# New drive: <z32 key>
```

#### Mirror any drive into another
Source and destination can be a folder path or a drive key.

```bash
drives mirror <src> <dst>
```

Use `--live` for real-time mirroring, and `--verbose` to show all logs.

Use `--dry-run` to disable writing, and remember there is `--help` for more.

#### Download a Hyperdrive
You can reuse the `mirror` command to download a `Hyperdrive` into the Corestore:

```bash
drives mirror <my-drive-key>
```

Note: it ignores `.drives`, `.git`, `.github`, `package-lock.json`, and `corestore` entries.

#### List files
```bash
drives ls <key or path>
```

#### Share a drive
```bash
drives seed [my-drive-key]
```

#### Archive download a Hyperdrive

Continuous `download` with all past historical states, useful to checkout on older versions:

```bash
drives download <my-drive-key>
```

#### Serve a drive via HTTP
```bash
drives serve <key or path>
# HTTP server on http://localhost:5000
```

URL requests are like `/path/to/file`, i.e. `http://localhost:5000/index.js`.

For security, requests to `/.drives/*` are rejected, so mind the storage location!

#### Show storage size, version, etc
```bash
drives info [my-drive-key]
```

## License
MIT
