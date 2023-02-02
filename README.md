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
  info [options] [key]          Show info about the Hyperdrive
```

## API
You can always add `--corestore [path]`, by default it's `./corestore`.

#### Create a writable Hyperdrive
```bash
drives touch
# New drive: <z32 key>
```

#### Mirror any drive into another
Source and destination can be a file system path or a drive key.

```bash
drives mirror <src> <dst>
```

Remember: it will use `./corestore` by default.

#### Share a drive
```bash
drives seed [my-drive-key]
```

#### Download a Hyperdrive
```bash
drives download <my-drive-key>
```

#### Show storage size, version, etc
```bash
drives info [my-drive-key]
```

## License
MIT
