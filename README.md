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

For more information, see the [documentation](doc/).
