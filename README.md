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
  download [options] <key>   Download a hyperdrive by key
  replicate [options] [key]  Replicate a hyperdrive to the DHT network
  mirror [options] [key]     Mirror a drive into another drive
  info [options] [key]       Show info about the hyperdrive
```

## Download

#### Save it into a corestore
```bash
drives download my-drive-key --corestore ./path
```

Optionally add `--localdrive <path>` to output the content into a folder.

#### Save it into a localdrive
Warning: This will create a corestore in RAM!

```bash
drives download my-drive-key --localdrive ./folder
```

## Replicate

#### Share a drive
```bash
drives replicate [my-drive-key] --corestore ./path
```

## Mirror
You can always add `--corestore [path]`, by default it's `./corestore`.

#### hyperdrive to localdrive
```bash
drives mirror <hyperdrive-key> ./output-path
```

#### hyperdrive to hyperdrive
```bash
drives mirror <hyperdrive-key> <hyperdrive-key>
```

#### localdrive to hyperdrive
```bash
drives mirror ./input-path <hyperdrive-key>
```

#### localdrive to localdrive
```bash
drives mirror ./input-path ./output-path
```

## License
MIT
