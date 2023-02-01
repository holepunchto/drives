# drives

CLI to create, download, seed, and mirror a Hyperdrive or Localdrive

```
npm i -g drives
```

## Usage
```bash
Usage: drives [options] [command]

Commands:
  touch [options]               Create a writable Hyperdrive
  download [options] <key>      Download a Hyperdrive by key
  seed [options] [key]          Seed a Hyperdrive to the DHT network
  mirror [options] <src> <dst>  Mirror a drive into another drive
  info [options] [key]          Show info about the Hyperdrive
```

## API
You can always add `--corestore [path]`, by default it's `./corestore`.

#### Create a writable Hyperdrive
```bash
drives touch
# New drive: <z32 key>
```

#### Download a Hyperdrive
```bash
drives download <my-drive-key> --corestore ./path
```

Optionally add `--localdrive <path>` to output the content into a folder.

#### Download a Hyperdrive into a Localdrive
Warning: This will create a corestore in RAM!

```bash
drives download <my-drive-key> --localdrive ./folder
```

#### Share a drive
```bash
drives seed [my-drive-key]
```

#### Mirror any drive into another
Source and destination can be a file system path or a drive key.

```bash
drives mirror <src> <dst>
```

## Mirror examples
Remember: it will use `./corestore` by default.

#### Hyperdrive to Localdrive
```bash
drives mirror <hyperdrive-key> ./output-path
```

#### Hyperdrive to Hyperdrive
```bash
drives mirror <hyperdrive-key> <hyperdrive-key>
```

#### Localdrive to Hyperdrive
```bash
drives mirror ./input-path <hyperdrive-key>
```

#### Localdrive to Localdrive
```bash
drives mirror ./input-path ./output-path
```

## License
MIT
