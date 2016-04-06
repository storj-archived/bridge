The {@link Config} class provides an interface for reading configuration files.
Bridge stores configuration in it's data directory which is located in
`$HOME/.storj-bridge`. A configuration is loaded by supplying the constructor with
an `env` or "environment" string.

The `env` string should correspond to a filename located in the
`$HOME/.storj-bridge/config` directory. When creating an instance of {@link Config},
the supplied configuration is loaded from disk and used to overload the default
configuration. Once you have an instance of {@link Config}, you can access it's
properties simply by using standard dot-syntax.
