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
