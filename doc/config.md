Class: Config(env)
==================

The `Config` class provides an interface for reading configuration files.
MetaDisk API stores configuration in it's data directory which is located in
`$HOME/.metadisk`. A configuration is loaded by supplying the constructor with
an `env` or "environment" string.

The `env` string should correspond to a filename located in the
`$HOME/.metadisk/config` directory. When creating an instance of `Config`, the
supplied configuration is loaded from disk and used to overload the default
configuration. Once you have an instance of `Config`, you can access it's
properties simply by using standard dot-syntax.

## Default Configuration

Below is a sample of the default configuration.

```json
{
  "storage": {
    "host": "127.0.0.1",
    "port": 27017,
    "name": "metadisk-dev",
    "user": null,
    "pass": null
  },
  "server": {
    "host": "127.0.0.1",
    "port": 6382,
    "ssl": {
      "cert": null,
      "key": null,
      "ca": [],
      "redirect": 80
    }
  },
  "network": {
    "address": "127.0.0.1",
    "port": 6383,
    "privkey": null,
    "verbosity": 4,
    "datadir": "~/.metadisk/items",
    "seed": {
      "address": "",
      "port": 0,
      "pubkey": null
    }
  }
}
```

### Storage

Provides information to MetaDisk API for connecting to a MongoDB database.

### Server

Provides information to MetaDisk API for serving the HTTP(S) REST API.

### Network

Provides information to MetaDisk API for connecting to the Storj network.
