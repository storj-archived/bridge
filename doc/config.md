The {@link Config} class provides an interface for reading configuration files.
Bridge stores configuration in it's data directory which is located in
`$HOME/.storj-bridge`. A configuration is loaded by supplying the constructor with
an `env` or "environment" string.

The `env` string should correspond to a filename located in the
`$HOME/.storj-bridge/config` directory. When creating an instance of {@link Config},
the supplied configuration is loaded from disk and used to overload the default
configuration. Once you have an instance of {@link Config}, you can access it's
properties simply by using standard dot-syntax.

| Parameter                 | Default       | Description                                                                                                              |
| --------------------------|---------------|--------------------------------------------------------------------------------------------------------------------------|
| storage.name              | null          | The name of the database that Bridge will use. It should be changed as to not conflict with running tests.               |
| storage.user              | null          | The username for your database. You should set a username and password unless your DB instance is only listening locally.|
| storage.pass              | null          | Same as above.
| server.host               | 127.0.0.1     | If your public IP is not bound to an interface on your host, you can set this to the IP bound to the interface with access to the internet or the network that Bridge traffic will travel accross. If you set this to a non public IP, you will also need to be sure to set the `server.public.host`. |
| server.public.host        | 127.0.0.1     | The hosts public IP address or a DNS record that resolves to the public IP address of the Bridge server. You only need to set this if `server.host` is set to a non public accessible IP address. |
| complex.rpcUrl            | http://localhost:8080 | The URI for the [storj complex](https://github.com/Storj/complex) service. Set this to the instance you have configured |
| complex.rpcUser           | username | The user name for authenticating with the Complex server |
| complex.rpcPassword       | password | the password for authenticating with the Complex server | 

The following is a sanitized version of the config that we use to run our Bridge servers. You can find the defaults in [`lib/config.js`](https://github.com/Storj/bridge/blob/master/lib/config.js).

```
{
  "server": {
    "host": "api.storj.io",
    "timeout": 60000,
    "port": 8080,
    "ssl": {
      "cert": true
    }
  },
  "storage": [
    {
      "name": "bridge",
      "host": "123.123.123.123",
      "port": 27017,
      "ssl": true,
      "user": "db_user",
      "pass": "super_strong_db_password",
      "mongos": {
        "checkServerIdentity": false,
        "ssl": true,
        "sslValidate": false
      }
    },
    {
      "name": "bridge",
      "host": "123.123.123.123",
      "port": 27017,
      "ssl": true,
      "user": "db_user",
      "pass": "super_strong_db_password",
      "mongos": {
        "checkServerIdentity": false,
        "ssl": true,
        "sslValidate": false
      }
    },
    {
      "name": "bridge",
      "host": "123.123.123.123",
      "port": 27017,
      "ssl": true,
      "user": "db_user",
      "pass": "super_strong_db_password",
      "mongos": {
        "checkServerIdentity": false,
        "ssl": true,
        "sslValidate": false
      }
    }
  ],
  "mailer": {
    "host": "smtp.myemail.com",
    "port": 465,
    "auth": {
      "user": "robot@storj.io",
      "pass": "super_awesome_password"
    },
    "secure": true,
    "from": "robot@storj.io"
  },
  "complex": {
    "rpcUrl": "http://localhost:8080",
    "rpcUser": "username",
    "rpcPassword": "password"
  }
}
```


