let express = require('express');
let fs = require('fs');
let cors = require('cors');
let http = require('http');
let https = require('https');
let privateKey  = fs.readFileSync('sslkeycert/server.key', 'utf8');
let certificate = fs.readFileSync('sslkeycert/server.crt', 'utf8');
let credentials = {key: privateKey, cert: certificate};
let app = express();
require("import-export");
require('dotenv').config();
let port = process.env.PORT;

app.use(cors());
app.use(require("./Router"));
http.createServer(app).listen(5006, function (err) {
    console.log('listening in http://127.0.0.1:' + 5006);
});

https.createServer(credentials, app).listen(port, function (err) {
    console.log('listening in https://127.0.0.1:' + process.env.PORT);
});
