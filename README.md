Storj Bridge
============

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

Edit `devel` in notepad/wordpad

For more information, see [the documentation](http://storj.github.io/bridge).

Configuration
=============

Recommended config changes

```
storage.name: The name of the database that Bridge will use. It should be changed as to not conflict with running tests.
storage.user: The username for your database. You should set a username and password unless your DB instance is only listening locally.
storage.pass: Same as above.

network.minions.privkey: This should be the same across all of your minions and any instances of the Bridge behind a loadbalancer talking to the same database and queue.
network.minions.address: The public IP address or a DNS record that resolves to the public IP address of the Bridge server

server.host: If your public IP is not bound to an interface on your host, you can set this to the IP bound to the interface with access to the internet or the network that Bridge traffic will traval accross. If you set this to a non public IP, you will also need to be sure to set the `server.public.host`.
server.public.host: The hosts public IP address or a DNS record that resolves to the public IP address of the Bridge server. You only need to set this if `server.host` is set to a non public accessible IP address.
```

The default configuration for Storj Bridge is as follows. You can find it in [the config.js lib](https://github.com/Storj/bridge/blob/master/lib/config.js#L62-L160).

```
Config.DEFAULTS = {
  storage: {
    host: '127.0.0.1',
    port: 27017,
    name: '__storj-bridge-test',
    user: null,
    pass: null,
    mongos: false,
    ssl: false
  },
  messaging: {
    url: 'amqp://localhost',
    queues: {
      renterpool: { // a shared work queue
        name: 'storj.work.renterpool',
        options: {
          exclusive: false,
          durable: true,
          arguments: {
            messageTtl: 120 * 1000 // messages expires after 120 seconds with no response
          }
        }
      },
      callback: { // each process gets a unique callback queue, to use in replyTo
        name: '', // dynamically generated
        options: {
          exclusive: true,
          durable: false
        }
      }
    },
    exchanges: {
      events: {
        name: 'storj.events',
        type: 'topic',
        options: {
          durable: true
        }
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 6382,
    timeout: 240000,
    ssl: {
      cert: null,
      key: null,
      ca: [],
      redirect: 80
    },
    public: {
      host: '127.0.0.1',
      port: 80
    }
  },
  network: {
    minions: [{
      bridge: false,
      privkey: null,
      address: '127.0.0.1',
      port: 6383,
      noforward: true,
      tunnels: 32,
      tunport: 6384,
      gateways: { min: 0, max: 0 }
    },
    {
      bridge: false,
      privkey: null,
      address: '127.0.0.1',
      port: 6385,
      noforward: true,
      tunnels: 32,
      tunport: 6386,
      gateways: { min: 0, max: 0 }
    },
    {
      bridge: false,
      privkey: null,
      address: '127.0.0.1',
      port: 6387,
      noforward: true,
      tunnels: 32,
      tunport: 6388,
      gateways: { min: 0, max: 0 }
    }],
  },
  mailer: {
    host: '127.0.0.1',
    port: 465,
    secure: true,
    auth: {
      user: 'username',
      pass: 'password'
    },
    from: 'robot@storj.io'
  }
};
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
