# drives

CLI to download, replicate, and mirror a hyperdrive or localdrive.

```
npm i -g drives
```

## Usage
```bash
Usage: drives [options] [command]

CLI to download, replicate, and mirror a hyperdrive or localdrive

Commands:
  touch [options] <key>      Create a writable hyperdrive
  download [options] <key>   Download a hyperdrive by key
  replicate [options] [key]  Replicate a hyperdrive to the DHT network
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
drives replicate [my-drive-key]
```

#### Mirror hyperdrive to localdrive
```bash
drives mirror <hyperdrive-key> ./output-path
```

#### Mirror hyperdrive to hyperdrive
```bash
drives mirror <hyperdrive-key> <hyperdrive-key>
```

#### Mirror localdrive to hyperdrive
```bash
drives mirror ./input-path <hyperdrive-key>
```

#### Mirror localdrive to localdrive
```bash
drives mirror ./input-path ./output-path
```

## License
MIT
