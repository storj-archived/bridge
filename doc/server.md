Class: Server(options, requestHandler)
======================================

The `Server` class is responsible for exposing the MetaDisk API over HTTP to
developers as well as to support the
[MetaDisk GUI](https://github.com/Storj/metadisk-gui) application. It accepts
the `server` property of a [`Config`](config.md) instance as well a
`requestHandler` function (typically an Express application instance).

## server.isConfiguredForSSL

Returns a `Boolean` indicating whether or not the supplied configuration is
set to serve the API over SSL.


Factory: Server.Routes(storage, network)
========================================

A factory method that returns a two-dimensional array containing information on
how API requests should be routed and handled. This is used by the
[`Engine`](engine.md) to setup the request handler that is passed to it's
`Server` instance.

Since the routes need access to [`Storage`](storage.md) and
[`Network`](network.md), instances of those classes must be passed in to this
factory method, so that the returned routing information is bound to those
instances.

Module: Server.middleware
=========================

The middleware module exposes a collection of Express middleware functions.

## middleware.rawbody

Used to buffer the entire raw request body, so that the `authenticate`
middleware can verify request signatures.

## middleware.authenticate(storage)

Used to authenticate requests. Requires a [`Storage`](storage.md) instance to
be supplied (this is a factory method).

First the middleware will check for HTTP Basic Authentication headers and, if
they are present, will authenticate the request by email address and hashed
password. This should only be used for initial registration and linking the
user's first [`storage.models.PublicKey`](storage.md#PublicKey).

If HTTP Basic Authentication headers are not present, then the middleware will
use the `x-pubkey` and `x-signature` headers to verify the request and
authenticate the user. The payload that must be signed should be the newline
separated HTTP method, API endpoint path, and either the raw request body or
querystring (depending on the request method). In addition, a `__nonce`
parameter must be supplied to prevent replay attacks.

### Example

The string to sign for a `createBucket` request:

```
POST
/buckets
{"storage":10,"transfer":30,"name":"my_bucket","pubkeys":[],"__nonce":123456789}
```
