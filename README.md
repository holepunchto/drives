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

#### hyperdrive to localdrive
```bash
drives mirror [my-drive-key] --corestore ./input-path --localdrive ./output-path
```

#### hyperdrive to hyperdrive
```bash
drives mirror [my-drive-key] --corestore ./input-path --corestore ./output-path
```

#### localdrive to hyperdrive
```bash
drives mirror --localdrive ./input-path --corestore ./output-path
```

#### localdrive to localdrive
```bash
drives mirror --localdrive ./input-path --localdrive ./output-path
```

## License
MIT
