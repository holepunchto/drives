# drives

CLI to download, seed, and mirror a Hyperdrive or Localdrive

```
npm i -g drives
```

## Usage
```bash
Usage: drives [options] [command]

Commands:
  touch [options]               Create a writable Hyperdrive
  mirror [options] <src> <dst>  Mirror a drive into another drive
  seed [options] [key]          Seed a Hyperdrive to the DHT network
  download [options] <key>      Download a Hyperdrive by key
  serve [options] <src>         Creates a HTTP drive server
  ls [options] <src>            List files of the drive
  info [options] [key]          Show info about the Hyperdrive
```

## API
Use `drives --help` for more information, `drives mirror --help`, etc.

You can always add `--corestore [path]`, by default it's `./corestore`.

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

#### Share a drive
```bash
drives seed [my-drive-key]
```

#### Download a Hyperdrive
```bash
drives download <my-drive-key>
```

#### Serve a drive via HTTP
```bash
drives serve <key or path>
# HTTP server on http://localhost:5000
```

URL requests are like `/path/to/file`, i.e. `http://localhost:5000/index.js`.

#### List files
```bash
drives ls <key or path>
```

Note: currently it ignores `.git`, `.github`, `node_modules`, and `corestore` entries.

#### Show storage size, version, etc
```bash
drives info [my-drive-key]
```

## License
MIT
