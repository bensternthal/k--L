const conf = require('./lib/conf');
const fs = require('fs');
const parse = require('csv-parse');
const request = require('request');
const sleep = require('system-sleep');
const cheerio = require('cheerio');
const chalk = require('chalk');
const async = require('async');
const urlUtils = require('url');

const csvFile = conf.get('csv');
const failureLog = './logs/failureLog.txt';
const requestErrorLog = './logs/requestErrorLog.txt';
const successLog = './logs/successLog.txt';
const sleepDelayMS = conf.get('sleepDelayMS');
let successCount = 0;
let failureCount = 0;
let errorCount = 0;
let four0fourCount = 0;
let kitsuneTitle = '';
let lithiumTitle = '';


/* Diable SSL Checking GLobally */
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

/* Options for HTTP Get Request, remove Auth if you are not testing stage */
let requestOptions = {
    auth: {
        username: conf.get('username'),
        password: conf.get('password'),
    },
    headers: [
        {
            name: 'Accept-Language',
            value: 'en',
        },
    ],
    followAllRedirects: 'true',
};


/* Receives file and passes each row to async functions to do all the things */
let parser = parse({delimiter: ','}, function(err, data) {
    if (err) {
        console.error('Error: ', err);
        return;
    }

    async.eachSeries(data, function(row, callback2) {
        let url = row[0];

        async.series([
            function(callback) {
                getKitsuneTitle(url, callback);
            },
            function(callback) {
                getLithiumTitle(url, callback);
            },
            function(callback) {
                logResult(url, callback);
            },
        ], function(err, result) {
            if (err) {
                console.error('Error: ', err);
            } else {
                //  Advance To Test Next Row, if you need to throttle comment out sleep line.
                // sleep(sleepDelayMS);
                callback2();
            }
        });
    }, function(err) {
        if(err) {
           console.error('Error: ', err);
         } else {
             // Done
           displaySummary();
         }
    });
});

/* Requests URL From Kitsune, Stores Title From Response */
function getKitsuneTitle(url, callback) {
    // Set URL to test
    requestOptions.url = url;

    request(requestOptions, function(error, response, body) {
        if (error) {
            callback('Error requesting Kitsune URL: ' + url);
        } else {
            /* Parse Body & Store Title */
            let $ = cheerio.load(body);
            kitsuneTitle = $('title').text();

            if (response.statusCode == '404') {
                four0fourCount++;
                writeToFile(requestErrorLog, 'Error 404: ' + requestOptions.url);
            }

            callback();
        }
    });
}


/* Requests URL From Lithium, Stores Title From Response */
function getLithiumTitle(url, callback) {
    // Append path from url to Lithium domain
    let parsedURL = urlUtils.parse(url);
    requestOptions.url = ('https://hwsfp35778.lithium.com' + parsedURL.path);

    request(requestOptions, function(error, response, body) {
        if (error) {
            callback('Error requesting Lithium URL: ' + url);
        } else {
            /* Parse Body & Store Title */
            let $ = cheerio.load(body);
            lithiumTitle = $('title').text();

            if (response.statusCode == 404) {
                four0fourCount++;
                writeToFile(requestErrorLog, 'Error 404: ' + requestOptions.url);
            }

            callback();
        }
    });
}


/* Tests if titles match, logs result */
function logResult(url, callback) {
    let result;

    /*  Kitsune Titles Follow this format
     *  `New in Thunderbird 52.0 | Thunderbird Help`
     *  we need to remove everything after the `|` to see if the same title exists.
     */
     let needle = kitsuneTitle.substr(0, kitsuneTitle.lastIndexOf('\|'));

    if ((lithiumTitle.search(needle)) != -1) {
        result = 'success';
        // process.stdout.write(' 😻 ');
        process.stdout.write(' . ');
    } else {
        result = 'failure';
        // process.stdout.write(' 😾 ');
        process.stdout.write(' X ');
    }

    switch (result) {
      case 'success':
        successCount++;
        writeToFile(successLog, 'Success: ' + url + ', ' + kitsuneTitle + ', ' + lithiumTitle);
        break;
      case 'failure':
        failureCount++;
        writeToFile(failureLog, 'Failure: ' + url + ', ' + kitsuneTitle + ', ' + lithiumTitle);
        break;
      default:
        errorCount++;
        writeToFile(requestErrorLog, 'Unknown Error: ' + URL);
    }
    callback();
}

/* Blocking function to write to file. */
function writeToFile(file, text) {
    fs.appendFileSync(file, text + '\n');
}

/* Summarizes output */
function displaySummary() {
    console.log('\n' + chalk.green.bold(('Success: ') + successCount));
    console.log(chalk.red.bold(('Failure: ') + failureCount));
    console.log(chalk.yellow.bold(('Unknown Errors: ') + errorCount));
    console.log(chalk.yellow.bold(('404s: ') + four0fourCount));
}


// Read CSV File, kicks off everything
fs.createReadStream(csvFile).pipe(parser);
