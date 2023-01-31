# drives

CLI to create, download, seed, and mirror a hyperdrive or localdrive

```
npm i -g drives
```

## Usage
```bash
Usage: drives [options] [command]

Commands:
  touch [options] <key>      Create a writable hyperdrive
  download [options] <key>   Download a hyperdrive by key
  seed [options] [key]       Seed a hyperdrive to the DHT network
  mirror [options] [key]     Mirror a drive into another drive
  info [options] [key]       Show info about the hyperdrive
```

## API
You can always add `--corestore [path]`, by default it's `./corestore`.

#### Create a writable hyperdrive
```bash
drives touch
# New drive: <z32 key>
```

#### Download a hyperdrive
```bash
drives download my-drive-key --corestore ./path
```

Optionally add `--localdrive <path>` to output the content into a folder.

#### Download a hyperdrive into a localdrive
Warning: This will create a corestore in RAM!

```bash
drives download my-drive-key --localdrive ./folder
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
