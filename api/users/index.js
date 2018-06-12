const router = require('express').Router();
/* Get Farms Schema */
const Ajv = require('ajv');
const ajv = Ajv({allErrors: true});
const schemas = require('../../lib/schemas');
const newUserSchema = ajv.compile(schemas.newUserSchema);
const loginUserSchema = ajv.compile(schemas.loginUserSchema);

exports.router = router;

const bcrypt = require('bcryptjs');
const validation = require('../../lib/validation');
const { getFarmsByUsername } = require('../farms');
const { generateAuthToken, requireAuthentication,
        SENSOR, USER, ADMIN } = require('../../lib/auth');




/******************************************************
*				Users Queries
*******************************************************/
function postNewUser(userDocument, mongoDB){
  return new Promise((resolve, reject) => {
    const usersCollection = mongoDB.collection('users');
    bcrypt.hash(userDocument.password, 8, function(err, hash){
      if(err){
        reject(err);
      }
      else{
        userDocument.password = hash;
        usersCollection.insertOne(userDocument)
          .then((result) => {
            resolve(result.insertedId);
          })
          .catch((err) => {
            reject(err);
          });
      }
    });
  });
}
function getUserByUserName(userName, mongoDB, includePassword){
  return new Promise((resolve, reject) => {
    const usersCollection = mongoDB.collection('users');
    const projection = includePassword ? {} : { password: 0 };
    usersCollection
    .find({username: userName})
    .project(projection)
    .toArray()
      .then((results) => {
          resolve(results[0]);
      })
      .catch((err) => {
        reject(err);
      });
    });
  }
function deleteUserByUserName(userName, mongoDB){
  const usersCollection = mongoDB.collection('users');
  return usersCollection.deleteOne({username: userName})
    .then((results) => {
        return Promise.resolve(results.deletedCount > 0);
    })
    .catch((err) => {
      reject(err);
    });
}












/******************************************************
*				Users Routes
*******************************************************/
/*
 * Route for a user to sign up
 */
router.post('/', function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  if (validation.validateAgainstSchema(req.body, newUserSchema)) {
    let clientData = req.body;
    clientData.authFarms = [];
    getUserByUserName(clientData.username, mongoDB)
      .then((isNotUnique) => {
        if(isNotUnique){
          res.status(400).json({
            error: `The username ${clientData.username} is already taken`
          });
        } else{
          return postNewUser(clientData, mongoDB);
        }
      })
      .then((insertId) => {
        res.status(201).json({
          id: insertId,
          username: clientData.username,
          /* Generate HATEOAS links for surrounding pages.*/
          links: {
            login: `/users/login`,
            user: `/users/${clientData.username}`
          }
        });
      })
      .catch((err) => {
        res.status(500).json({
          error: `Unable to insert the new user into the database`
        });
      });
  } else {
    res.status(400).json({
      error: "Request body is not a valid new user object"
    });
  }
});
/*
 * Route for a user to login and get a JWT
 */
router.post('/login', function (req, res) {
  const mongoDB = req.app.locals.mongoDB;
  if (validation.validateAgainstSchema(req.body, loginUserSchema)) {
    let clientData = req.body;
    let userObj = {};
    getUserByUserName(clientData.username, mongoDB, true)
      .then((user) => {
        if (user) {
          userObj = user;
          return bcrypt.compare(clientData.password, user.password);
        } else {
          return Promise.reject(401);
        }
      })
      .then((loginSuccessful) => {
        if (loginSuccessful) {
          return generateAuthToken(userObj.username, userObj._id, userObj.authFarms);
        } else {
          return Promise.reject(401);
        }
      })
      .then((token) => {
        res.status(200).json({
          auth: true,
          token: token
        });
      })
      .catch((err) => {
        if (err === 401) {
          res.status(401).json({
            error: "Invalid credentials."
          });
        } else {
          res.status(500).json({
            error: "Failed to fetch user."
          });
        }
      });
  } else {
    res.status(400).json({
      error: "Request needs a username and password."
    })
  }
});
/*
 * Route to get the users data.
 */
router.get('/:userName', requireAuthentication, function (req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const userName = req.params.userName;
  if (req.username !== userName) {
      res.status(403).json({
        error: "Unauthorized to access that resource"
      });
  }
  else {
    getUserByUserName(userName, mongoDB)
      .then((userObject) => {
        if(userObject){
          res.status(200).json(userObject);
        }
        else{
          next();
        }
      })
      .catch((err) => {
        res.status(500).json({
          error: `Unable to fetch the user's farms from the database`
        });
      });
  }
});
/*
 * Route to delete a user.
 */
router.delete('/:userName', requireAuthentication, function (req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const userName = req.params.userName;
  if (req.username !== userName) {
      res.status(403).json({
        error: "Unauthorized to access that resource"
      });
  }
  else {
    deleteUserByUserName(userName, mongoDB)
      .then((userObject) => {
        if(userObject){
          res.status(204).send();
        }
        else{
          next();
        }
      })
      .catch((err) => {
        res.status(500).json({
          error: `Unable to fetch the user's farms from the database`
        });
      });
  }
});
/*
 * Route to list all of a user's farms.
 */
router.get('/:userName/farms', requireAuthentication, function (req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const userName = req.params.userName;
  if (req.username !== userName) {
      res.status(403).json({
        error: "Unauthorized to access that resource"
      });
  }
  else {
    getFarmsByUsername(req.username, mongoDB)
      .then((userFarms) => {
        res.status(200).json({
          farms: (userFarms || [])
        });
      })
      .catch((err) => {
        res.status(500).json({
          error: `Unable to fetch the user's farms from the database`
        });
      });
  }
});
