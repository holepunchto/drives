# drives

CLI to seed and mirror a Hyperdrive or Localdrive

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

By default, it tries to use `.drives` from the current directory.

If it doesn't exists then it will go back `../` until it finds an existing `.drives`.

If it doesn't find anything, then it will create and use a global folder at `~/.drives`.

You can always set `--storage [path]` to force a different location.

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

#### Seed a drive
```bash
drives seed [my-drive-key]
```

Seed a hyperdrive so others can download it.

## License

Apache-2.0
