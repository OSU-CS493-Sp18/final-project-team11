const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const api = require('./api');
const app = express();

const MongoClient = require('mongodb').MongoClient;

const port = process.env.PORT || 8000;

/******************************************************
*				MongoDB Connection Setup
*******************************************************/
const mongoHost = process.env.MONGO_HOST;
const mongoPort = process.env.MONGO_PORT || '27017';
const mongoDBName = process.env.MONGO_DATABASE;
const mongoUser = process.env.MONGO_USER;
const mongoPassword = process.env.MONGO_PASSWORD;
const mongoURL = `mongodb://${mongoUser}:${mongoPassword}@${mongoHost}:${mongoPort}/${mongoDBName}`
console.log("== Mongo URL:", mongoURL);
/******************************************************
*				Server Endpoint Preprocessing
*******************************************************/
/*
 * Morgan is a popular logger.
 */
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(express.static('public'));
/*
 * All routes for the API are written in modules in the api/ directory.  The
 * top-level router lives in api/index.js.  That's what we include here, and
 * it provides all of the routes.
 */
app.use('/', api);

app.use('*', function (req, res, next) {
  res.status(404).json({
    error: "Requested resource " + req.originalUrl + " does not exist"
  });
});
/******************************************************
*				Start Server
*******************************************************/
MongoClient.connect(mongoURL, function (err, client) {
  if (!err) {
    app.locals.mongoDB = client.db(mongoDBName);
    app.listen(port, function() {
      console.log("== Server is running on port", port);
    });
  }
});
