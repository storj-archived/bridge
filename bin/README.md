# Storj Audit Tool CLI

This tool iterates over a list of nodeIDs and for each nodeID, it downloads a random selection of shards from the given node (aka farmer aka contact).
Could potentially be used to check shard challenges to ensure shard integrity.

To test with mongo, we first made a temporary mongo directory:
```
mkdir /tmp/mongo
```
Then we set the db path:
```
mongod --dbpath /tmp/mongo
```
After you have mongo running, you can pipe your document of nodeIds to the audit tool with this command:
```
cat nodeIds.txt | node storj-audit-tool -o <outputpath>
```
-----------------
### Testing in Integration

With `storj-audit-tool.js` in `/root/node_modules/storj-bridge/bin/`, first you need to register a user to the integration bridge. You can read how to register and activate a bridge user [here](https://github.com/navillasa/storj-miniproxy). After you register a user, use the CLI to upload some files so that you'll be able to request shards back from the farmers with the audit tool.
Then go into the mongo shell by typing `mongo` into the root.
Then `use storj-sandbox`.
Then `db.contacts.find({}).pretty()`.

You can then make a list of the nodeIDs returned by this query-- there should be 16 farmers running by default. You don't have to put all 16 nodeIDs in the list. You can save this list to a text file called `nodeIDs.txt` in `/root/node_modules/storj-bridge/bin/`.

Then back inside `/root/node_modules/storj-bridge/bin/`, run:
```
cat nodeIds.txt | node storj-audit-tool -o <outputpath> -c /root/config/storj-bridge/config.json
```

-----------------
### Final Usage

For the audit tool:
```
cat contacts.csv | node storj-audit-tool.js -o /tmp/storj -c /path/to/config.json
```

To run the report tool on the data saved in leveldb:
```
node storj-audit-report -o /tmp/storj -c /path/to/config.json
```
