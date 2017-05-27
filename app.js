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
const successCount = 0;
const failureCount = 0;
const errorCount = 0;
let kitsuneTitle = "";
let lithiumTitle = "";

/* Diable SSL Checking GLobally */
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

/* Options for HTTP Get Request, remove Auth if you are not testing stage */
var requestOptions = {
    auth: {
        username: conf.get('username'),
        password: conf.get('password')
    },
    headers: [
        {
            name: 'Accept-Language',
            value: 'en'
        }
    ],
    followAllRedirects: 'true'
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
            }
        ], function(err, result) {
            if (err) {
                console.log(err);
            } else {
                console.log('next');
                callback2();
            }            
        });
    }, function(err) {
        if(err) {
           console.log('error');
         } else {
           console.log('...done');
         }
    });
});



/* TODO: write comment*/
function getKitsuneTitle(url, callback) {
    // Set URL to test
    requestOptions.url = url;
    request(requestOptions, function(error, response, body) {
        if (error) {
            callback('error');
        } else {
            /* Parse Body & Store Title */
            let $ = cheerio.load(body);
            kitsuneTitle = $('title').text();
            console.log(kitsuneTitle);
            callback();
        }
    });
}

/* TODO: write comment*/
function getLithiumTitle(url, callback) {
    // Set URL to test    
    var parsedURL = urlUtils.parse(url);
    requestOptions.url  = ('https://hwsfp35778.lithium.com' + parsedURL.path);    
    console.log('https://hwsfp35778.lithium.com' + parsedURL.path);
    request(requestOptions, function(error, response, body) {
        if (error) {
            callback('error');
        } else {
            /* Parse Body & Store Title */
            let $ = cheerio.load(body);
            lithiumTitle = $('title').text();
            console.log(lithiumTitle);
            callback();
        }
    });
}







/* if Final URL ID Matches URL (after all the redirects) record success if not record failure */
function writeResultsNEW(responseType, response, csvRow, error) {
    switch (responseType) {
      case 'success':
        successCount++;
        fs.appendFileSync(successLog, 'Success: ' + csvRow.originalURL + " , " + csvRow.finalURL + "\n");
        break;
      case 'failure':
        failureCount++;
        fs.appendFileSync(failureLog, 'Failure: ' + csvRow.originalURL + " , " + csvRow.finalURL + " , " + response.request.uri.href +
        " , CSV Supplied ID: " + csvRow.finalURLID + " , Lithium Returned ID: " + csvRow.responseURLID + '\n');
        break;
      case 'error':
        errorCount++;
        fs.appendFileSync(requestErrorLog, error + ' ' + csvRow.originalURL + "\n");
        break;
      default:
        fs.appendFileSync(requestErrorLog, 'Unknown Error' + ' ' + csvRow.originalURL + "\n");
    }
}

/* Given a url https://foo.bar/foo/1234 returns only the integer after the last "/". If
 * something unexpected happens adds some strings that will be logged to help debug */
function getID (url) {
    if (url) {
        var n = url.lastIndexOf('/');
        
        if (n !== -1) {
            var id = parseInt(url.substring(n + 1));
            if (isNaN(id)) {
                return "ID Returned Is Not A Number";
            } else {
                return id;
            }
        } else {
            return "ID Missing";
        }        
    } else {
        console.log(chalk.red.bold((' Failure: Check URL Mapping \n')));
        return('Missing URL: Check CSV Column Mapping');
    }
}

/* Summarizes output */
function displaySummary() {
    console.log("\n" + chalk.green.bold(('Success: ') + successCount)); 
    console.log(chalk.red.bold(('Failure: ') + failureCount));
    console.log(chalk.magenta.bold(('Errors: ') + errorCount)); 
}

// Read CSV File, kicks off everything
fs.createReadStream(csvFile).pipe(parser);
