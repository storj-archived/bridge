MetaDisk API
============

[![Build Status](https://img.shields.io/travis/Storj/metadisk-api.svg?style=flat-square)](https://travis-ci.org/Storj/metadisk-api)
[![Coverage Status](https://img.shields.io/coveralls/Storj/metadisk-api.svg?style=flat-square)](https://coveralls.io/r/Storj/metadisk-api)

Access the [Storj](http://storj.io) network via simple REST API.

Quick Start
-----------

Install NVM, Node.js and NPM:

```bash
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.30.1/install.sh | bash
nvm install 4.2.3
```

Clone the repository, install dependencies:

```bash
git clone https://github.com/Storj/metadisk-api.git
cd metadisk-api
npm install && npm link
```

Start the local server:

```bash
metadisk <env_name>
```

Configuration
-------------

MetaDisk API loads configuration from `$HOME/.metadisk/config/<env_name>`. To
override the default configuration, create a file named `<env_name>` and then
specify that name when running `metadisk`.

For instance, to create a customn development configuration, you might create
`$HOME/.metadisk/config/devel` with the following contents:

```json
{
  "storage": {
    "name": "metadisk-devel"
  },
  "server": {
    "port": "8443"
  }
}
```

The configuration supplied in this file will *override* the defaults. If you
omit a property, it will use the default. Defaults can be viewed in
`lib/config.js`.
