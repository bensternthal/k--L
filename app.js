const conf = require('./lib/conf');
const fs = require('fs');
const parse = require('csv-parse');
const request = require('request');
const cmd = require('commander');
const sleep = require('system-sleep');
const cheerio = require('cheerio');
const chalk = require('chalk');
const async = require('async');
const urlUtils = require('url');

const failureLog = './logs/failureLog.txt';
const requestErrorLog = './logs/requestErrorLog.txt';
const successLog = './logs/successLog.txt';
const sleepDelayMS = conf.get('sleepDelayMS');
const lithiumURL = conf.get('lithiumURL');
let successCount = 0;
let failureCount = 0;
let errorCount = 0;
let four0fourCount = 0;
let kitsuneTitle = '';
let lithiumTitle = '';


/* Command Line Options For Path To CSV File & Locale */
cmd
  .option('-c, --csv <csv>', 'Path to csv file')
  .option('-l, --locale <locale>', 'Locale code "en" ')
  .parse(process.argv);


/* Diable SSL Checking GLobally */
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

/* Options for HTTP Get Request, Accept-Language passed via command line option. */
let requestOptions = {
    auth: {
        username: conf.get('username'),
        password: conf.get('password'),
    },
    headers: {
            'Accept-Language': cmd.locale,
    },
    followAllRedirects: 'true',
};


/* Receives file and passes each row to sync functions to do all the things.. nsync */
let parser = parse({delimiter: ','}, function(err, data) {
    if (err) {
        console.error('Error: ', err);
        return;
    }

    async.eachSeries(data, function(row, callback2) {
        // These are not csv files, it's one url per line but whatever.
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


/* Requests URL From Lithium, Stores Title From Response  TODO: combine
the two getTitle functions into one */
function getLithiumTitle(url, callback) {
    // Get and Append path from url to Lithium domain
    let parsedURL = urlUtils.parse(url);
    requestOptions.url = ( lithiumURL + parsedURL.path);

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
        // comment out if you like cats and your terminal supports emoji
        // process.stdout.write(' 😻 ');
        process.stdout.write(' . ');
    } else {
        result = 'failure';
        // comment out if you like cats and your terminal supports emoji
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

/* Sync write to file. */
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


/* Parse command line options */
if ((typeof cmd.csv === 'undefined') || (typeof cmd.locale === 'undefined')) {
   console.error('Error: CSV & Locale Must Both Be Specified, run "node app.js --help" for more information.');
   process.exit(1);
} else {
    // Read CSV File from commander option, kicks off everything
    fs.createReadStream(cmd.csv).pipe(parser);
}



