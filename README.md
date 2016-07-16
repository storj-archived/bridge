Storj Bridge
============d

[![Build Status](https://img.shields.io/travis/Storj/bridge.svg?style=flat-square)](https://travis-ci.org/Storj/bridge)
[![Coverage Status](https://img.shields.io/coveralls/Storj/bridge.svg?style=flat-square)](https://coveralls.io/r/Storj/bridge)
[![NPM](https://img.shields.io/npm/v/storj-bridge.svg?style=flat-square)](https://www.npmjs.com/package/storj-bridge)
[![GitHub license](https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat-square)](https://raw.githubusercontent.com/Storj/data-api/master/LICENSE)

Access the [Storj](http://storj.io) network via simple REST API.

Quick Start
-----------

With Vagrant
============

Download and install [vagrant](https://www.vagrantup.com/downloads.html) for your platform.

Clone the repository:

```
git clone https://github.com/Storj/bridge.git
cd bridge
```

Start up the vagrant VM:

```
vagrant up
```
_NOTE: the first time you `vagrant up` it will take a while as vagrant downloads the base VM and provisions it._


SSH into the vm and start the server (set the `NODE_ENV` environment variable to specify the config):

```
vagrant ssh
NODE_ENV=develop storj-bridge
```

#### Running node server on host with mongo and rabbitmq on guest
It is also possible to run the node server on your host but still wish to use the VM for mongo and rabbitmq.
You may want to so this so you can remotely debug using an IDE running on the host 
or connect other host-borne tools to these services, for example.

To do this you just need to uncomment lines `33` and `36` of the `Vagrantfile` to forward the mongo and rabbitmq ports to your host:
```yaml
# Uncomment to forward mongo
config.vm.network "forwarded_port", guest: 27017, host: 27017

# Uncomment to forward rabbitmq
config.vm.network "forwarded_port", guest: 5672, host: 5672
```

If you're going to start the bridge web server on your host you should comment out line `30` so that your host port is free.

```yaml
# Default bridge server HTTP port
config.vm.network "forwarded_port", guest: 6382, host: 6382
```

After making any changes to the `Vagrantfile` you can apply them with a

```bash
vagrant reload
```

_NOTE: don't manually change any VM settings via your provider's interface as they will be overriden by the vagrantfile and/or may cause conflicts._

Manually
========

Install MongoDB, Git and Wget:

```
apt-get install mongodb git wget
```

Install NVM, Node.js and NPM:

```
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.30.1/install.sh | bash
source ~/.profile
nvm install 4.2.3
```

Clone the repository, install dependencies:

```
git clone https://github.com/Storj/bridge.git
cd bridge
npm install && npm link
```

Start the server (set the `NODE_ENV` environment variable to specify the config):

```
NODE_ENV=production
```

This will use the configuration file located at `~/.storj-bridge/config/develop.json`.
For local testing and development, you can run Storj Bridge and a farmer to seed
it using the included development script:

```
cd /path/to/storj-bridge
npm run develop
```

Windows
========

Install utilizing automated script

```
https://github.com/Storj/storj-automation/archive/master.zip
```

The default configuration can be modified as needed.  It is located at

```
%USERPROFILE%\.storj-bridge\config
```

Edit `production` in notepad/wordpad

For more information, see [the documentation](http://storj.github.io/bridge).

Configuration
=============

Recommended config changes

| Parameter                 | Default       | Description                                                                                                              |
| --------------------------|---------------|--------------------------------------------------------------------------------------------------------------------------|
| storage.name              | null          | The name of the database that Bridge will use. It should be changed as to not conflict with running tests.               |
| storage.user              | null          | The username for your database. You should set a username and password unless your DB instance is only listening locally.|
| storage.pass              | null          | Same as above.
| network.minions.privkey   | null          | This should be the same across all of your minions and any instances of the Bridge behind a loadbalancer talking to the same database and queue.
| network.minions.address   | 127.0.0.1     | The public IP address or a DNS record that resolves to the public IP address of the Bridge server
| server.host               | 127.0.0.1     | If your public IP is not bound to an interface on your host, you can set this to the IP bound to the interface with access to the internet or the network that Bridge traffic will traval accross. If you set this to a non public IP, you will also need to be sure to set the `server.public.host`. |
| server.public.host        | 127.0.0.1     | The hosts public IP address or a DNS record that resolves to the public IP address of the Bridge server. You only need to set this if `server.host` is set to a non public accessible IP address. |

The following is a sanatized version of the config that we use to run our Bridge servers. You can find the defaults in [the config.js lib](https://github.com/Storj/bridge/blob/master/lib/config.js#L62-L160).

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
  "messaging": {
    "url": "amqp://amqp_user:amqp_password@my_queue.storj.io",
    "queues": {
      "renterpool": {
        "name": "storj.work.renterpool",
        "options": {
          "exclusive": false,
          "durable": true,
          "arguments": {
            "messageTtl": 120000
          }
        }
      },
      "callback": {
        "name": "",
        "options": {
          "exclusive": true,
          "durable": false,
          "arguments": {
          }
        }
      }
    },
    "exchanges": {
      "events": {
        "name": "storj.events",
        "type": "topic",
        "options": {
          "durable": true
        }
      }
    }
  },
  "network": {
    "minions": [
      {
        "bridge": false,
        "address": "234.234.234.234",
        "port": 8443,
        "tunport": 8444,
        "tunnels": 16,
        "gateways": { "min": 8500, "max": 8532 },
        "privkey": "8439823498923482938489239498329489283498293849898239849234989293"
      },
      {
        "bridge": false,
        "address": "234.234.234.234",
        "port": 8445,
        "tunport": 8446,
        "tunnels": 16,
        "gateways": { "min": 8600, "max": 8632 },
        "privkey": "8439823498923482938489239498329489283498293849898239849234989293"
      },
      {
        "bridge": false,
        "address": "234.234.234.234",
        "port": 8447,
        "tunport": 8448,
        "tunnels": 16,
        "gateways": { "min": 8700, "max": 8732 },
        "privkey": "8439823498923482938489239498329489283498293849898239849234989293"
      }
    ]
  },
  "mailer": {
    "host": "smtp.myemail.com",
    "port": 465,
    "auth": {
      "user": "robot@storj.io",
      "pass": "super_awesome_password"
    },
    "secure": true,
    "from": "robot@storj.io"
  }
}
```


License
-------

```
Storj Bridge - Access The Storj Network via REST Interface
Copyright (C) 2016  Storj Labs, Inc

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
```

Terms
-----

This software is released for testing purposes only. We make no guarantees with
respect to its function. By using this software you agree that Storj is not
liable for any damage to your system. You also agree not to upload illegal
content, content that infringes on other's IP, or information that would be
protected by HIPAA, FERPA, or any similar standard. Generally speaking, you
agree to test the software responsibly. We'd love to hear feedback too.
