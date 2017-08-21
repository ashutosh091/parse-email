let dataFolder = '/Users/ashutosh/Downloads/job/';
let outputFolder = '/data/cvs/';
const fs = require('fs');
const simpleParser = require('mailparser').simpleParser;
const readline = require('readline');
const Readable = require('stream').Readable;
const http = require('http');
const url = require('url');
const shortid = require('shortid');
const async = require('async');
const args = require('command-line-args')

const optionDefinitions = [
    { name: 'src', type: String },
    { name: 'dest', type: String },
];

const options = args(optionDefinitions);

dataFolder = options.src == null? dataFolder: options.src;
outputFolder = options.dest == null? outputFolder: options.dest;

let q = async.queue(downloadResume, 5);

// assign a callback
q.drain = function () {
    //console.log('All items have been processed');
};

fs.readdir(dataFolder, (err, files) => {
    files.forEach(file => {
        if (fs.lstatSync(dataFolder + file).isDirectory()) {
            processFolder(dataFolder + file);
        }
    })
});

function downloadResume(record, callback) {
    //console.log('Downloading ' + record.name + ' from ' + record.url);
    let file = fs.createWriteStream(outputFolder + record.name, {
        autoClose: true
    });
    let request = http.get(record.url, function (response) {
        response.pipe(file);
    });
    callback();
}

function extractResumeURL(line, out, name) {
    let cvurl = line.slice(line.indexOf('<') + 1, line.indexOf('>'));
    let parts = url.parse(cvurl, true);
    let ext = parts.query['gf-download'];
    if (ext != null) {
        ext = ext.substr(ext.indexOf('.') + 1);
        let fileName = name + '-' + shortid.generate() + '.' + ext;
        out = out + '"' + cvurl + '","' + fileName + '",';

        q.push({
            url: cvurl,
            name: fileName
        }, function (err) {
            //console.log('finished processing url');
        });
    } else {
        out = out + '"","",';
    }
}

function readLines(str, out) {
    let rd = readline.createInterface({
        input: str,
        output: null,
        console: false,
    });

    let index = 1,
        name = '';
    rd.on('line', line => {
        if (line.trim() !== '') {
            line = line.trim();
            index++;
            out = out + '"' + line + '",';

            if (index == 3) {
                name = line;
            } else if (index == 13) {
                extractResumeURL(line, out, name);
            } else if (index == 16) {
                console.log(out);
            }
        }
    });
}

function processFolder(dataFolder) {
    fs.readdir(dataFolder, (err, files) => {
        files.forEach(file => {
            if (file.endsWith('.eml')) {
                fs.readFile(dataFolder + '/' + file, (err, data) => {
                    if (err) console.log(err);
                    simpleParser(data).then(mail => {
                        //console.log(mail.subject);
                        //console.log(mail.text);
                        let str = new Readable();
                        str.push(mail.text);
                        str.push(null);

                        let out = file + ',';

                        readLines(str, out);
                    }).catch(err => {
                        console.log('Simple Parser error' + err);
                    });
                });
            }
        });
    })
}
