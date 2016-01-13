Class: Network(options)
=======================

The `Network` class is responsible for connecting MetaDisk API to other
Storj nodes. It accepts the `network` property of a [`Config`](config.md)
instance as it's only parameter.

As soon as a `Network` instance is created, it will begin bootstrapping it's
connection to the network and start building it's routing table.

## network.createReadStream(filePointer)

Accepts a [`storage.models.File`](storage.md#File) document to resolve a file
stored in the network. Returns a `stream.Readable` that can be piped to another
stream that is writable.

## network.createTransferStream()

Returns a `stream.Transform` to which you may pipe a `stream.Readable`. Chunks
written to this stream are serialized and stored in the network, while each
stored chunk is transformed into it's hash on the readable end of this stream.
This hash can be used to later resolve that individual chunk from the network.
