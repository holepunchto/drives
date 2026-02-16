# drives

CLI to seed and mirror a Hyperdrive or Localdrive. Useful for sharing files between machines.

## Install

```
npm i -g drives
```

## Usage

```
drives [flags] [command]

Commands:
  touch              Create a writable Hyperdrive
  mirror <src> <dst> Mirror a drive into another drive
  seed [key]         Seed a hyperdrive so others can download it
```

## API

Use `drives --help` for more information, `drives mirror --help`, etc.

#### Storage

By default, it tries to use `~/.drives`.

Set `--storage [path]` to use a different location.

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

Options:

- `--live` for real-time mirroring
- `--version [v]` to use a specific version
- `--storage [path]` to specify storage location

It is recommended to set either the `--live` or the `--version` flag (either download changes as they come in, or download a specific version).

#### Seed a drive

```bash
drives seed [my-drive-key]
```

Seed a hyperdrive so others can download it.

## Example

Peer 1 wants to share a local folder with peer 2.

Peer 2 wants to continuously pull in changes.

#### Peer 1:

Create a new Hyperdrive

```
drives touch
```

Output: `New drive: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`

Copy a local folder into the new Hyperdrive

```
drives mirror /my/local/dir/ aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

Make the Hyperdrive available to other peers

```
drives seed aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

#### Peer 2:

Download the hyperdrive to a local directory, and continuously pull in changes.

Warning: if the target folder already exists, its files will be deleted.

```
drives mirror --live aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa /my/downloads/copy-of-local-dir
```
