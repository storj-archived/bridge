# Storj Audit Tool CLI

This tool iterates over a list of farmer IDs (nodeIDs) and for each nodeID, it downloads a random selection of shards.
Could potentially check shards' challenges to ensure shards' integrity.

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
If you're testing this in integration, with `storj-audit-tool.js` in `/root/node_modules/storj-bridge/bin/`, first you need to register a user to the integration bridge, then upload some files. You can read how to register and activate a farmer (here)[https://github.com/navillasa/storj-miniproxy].
Then go into mongo by typing `mongo` into the root. Then `use storj-sandbox`.
Then `db.contacts.find({}).pretty()`.

Then make a list of the nodeIDs returned by this query-- there should be 16 farmers running by default, so 16 nodeIDs. You don't have to put all 16 nodeIDs in the list. You can save this list to a text file called `nodeIDs.txt` in `/root/node_modules/storj-bridge/bin/`.

Then back inside `/root/node_modules/storj-bridge/bin/`, run:
```
cat nodeIds.txt | node storj-audit-tool -o <outputpath> -c /root/config/storj-bridge/config.json
```
