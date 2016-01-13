Class: Engine(config)
=====================

The `Engine` class acts as the primary controller for a MetaDisk API instance.
It is responsible for opening a connection to the database, starting the HTTP
server, and joining the Storj network via the [`Storage`](storage.md),
[`Server`](server.md), and [`Network`](network.md) interfaces.

The `Engine` constructor requires an instance of [`Config`](config.md) to be
passed as it's only parameter.

## engine.start()

Initializes the MetaDisk API engine.
