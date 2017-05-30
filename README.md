## About

1. Reads in a list of URLs from a .csv file, one URL per line.
1. Requests url from kitsune.
1. Requests url from lithium stage.
1. Compares the title of both pages, if it matches.. success, if not failure.
1. Records results in /logs

## Usage

1. create `./logs` directory for log output
1. npm install
1. copy local.json.dist -> local.json, populate values if needed.
1. run with `node app.js -c ./csv/test1.csv -l en`
1. -c = path to csv file/list of URLs
1. -l = locale
1. both path and locale are required

## Example CSV files

A few examples are in ./csv.