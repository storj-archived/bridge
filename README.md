MetaDisk API
============

[![Build Status](https://img.shields.io/travis/Storj/metadisk-api.svg?style=flat-square)](https://travis-ci.org/Storj/metadisk-api)
[![Coverage Status](https://img.shields.io/coveralls/Storj/metadisk-api.svg?style=flat-square)](https://coveralls.io/r/Storj/metadisk-api)

Access the [Storj](http://storj.io) network via simple REST API.

Quick Start
-----------

Install NVM, Node.js and NPM:

```
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.30.1/install.sh | bash
nvm install 4.2.3
```

Install MongoDB:

```
apt-get install mongodb
```

Clone the repository, install dependencies:

```
git clone https://github.com/Storj/metadisk-api.git
cd metadisk-api
npm install && npm link
```

Start the local server:

```
metadisk
```

For more information, see [the documentation](http://storj.github.io/metadisk-api).
