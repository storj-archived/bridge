Bridge understands 3 methods for authentication, which can vary depending on
the operation you wish to perform.

### HTTP Basic

HTTP Basic authentication is supported as a fallback for situations where key
management is not available or specifically for use before a public key has
been associated with your user account.

Your `username` should simply be your registered email address.

Your `password` should be the SHA-256 hash of your password.

### ECDSA Signatures

Once you have added a public ECDSA key to your account, you can use your
private key to sign messages to the server to avoid sending your credentials in
every request. This is the recommended authentication method.

The string that you are expected to sign differs depending on the type of
request. For POST, PUT, and PATCH requests, you must sign the JSON encoded body
of the request. For GET, DELETE, and OPTIONS requests, you must sign the raw
query string parameters.

In addition to the parameters required for each individual request, you must
also include a `__nonce` parameter. This value should be an integer and must be
incremented with every request. A common practice is to simply use the current
UNIX timestamp.

In addition to the request parameters and nonce, you will also sign the HTTP
method and request path. Ultimately the string you will sign will be:

```
<METHOD>\n<PATH>\n<PARAMS>
```

For example, to generate a signature for creating a new storage bucket, you
will sign:

```
POST\n/buckets\n{"storage":10,"transfer":30,"name":"MyBucket","__nonce":1453222669376}
```

This tells the server that at Tue Jan 19 2016 11:57:49 GMT-0500 (EST), you
authorized a request to created a bucket called "MyBucket" with 10GB of capacity
and 30GB of transfer. This request cannot be replayed, since the nonce cannot
be reused.

Once you have generated the signature, it must be encoded as HEX and included
in the `x-signature` header.

In addition you must supply the public key for verifying the signature in the
`x-pubkey` header.

Bridge will first lookup the user account to which the supplied public key is
registered and then use it to verify the signature.

### OpenSSL example

Create ECDSA private key and print out public key

```
openssl ecparam -genkey -name secp256k1 -noout -outform DER -out private.key
openssl ec -inform DER -in private.key -noout -text
```

Register public key (HTTP basic auth)

```
curl -u user:password -X POST --header 'Content-Type: application/json' --header 'Accept: application/json' -d '{ "key": "043874de22536decc5508257cc806a9e5af5e8be6a80056843d5c0c2b112903430f9a46c128ca17e30e2fb54f541416185dda2df878adbb90d66811452f4162125" }' 'https://api.storj.io/keys'
```

Generate signature and use it for API call

```
printf "POST\n/buckets\n{\"storage\":10,\"transfer\":30,\"name\":\"MyBucket\",\"__nonce\":1453222669376}" | openssl dgst -sha256 -hex -sign private.key -keyform DER
curl --header "x-signature:3046022100e5b534eba11f19d4e3e92398e4ffdf8195041a7de13a1ffe8eb3baf66eb694b8022100982837e3b449fc9e4524009acd03800abf6447cf225a83d6f21bfa67a8326465" --header "x-pubkey:043874de22536decc5508257cc806a9e5af5e8be6a80056843d5c0c2b112903430f9a46c128ca17e30e2fb54f541416185dda2df878adbb90d66811452f4162125" -X POST --header 'Content-Type: application/json' --header 'Accept: application/json' -d '{"storage":10,"transfer":30,"name":"MyBucket","__nonce":1453222669376}' 'https://api.storj.io/buckets'
```

### Single Use Tokens

There are 2 cases where signing the request body is not efficient for the client
and verifying the signature is not efficient for the server. This is when the
user wishes to push or pull data to or from a bucket.

If a file is quite large, the server would have to buffer it's entire contents
in order to verify the signature. This is where single-use tokens come into
play.

Instead of signing the upload request, you sign a request for a `token` that
corresponds to a bucket, then use that token in the `x-token` header in your
upload request. This also provides a way for users to grant access to others to
upload files to their bucket by generating a token for them (since anyone with
the token may upload the file to the bucket).

Tokens can be configured to expire (default is 5 minutes) and may only be used
once.
