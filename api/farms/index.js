const router = require('express').Router();
exports.router = router;
exports.verifyValidFarmID = verifyValidFarmID;

const validation = require('../../lib/validation');
const { generateMongoIDQuery } = require('../../lib/mongoHelpers');
const { requireAuthentication } = require('../../lib/auth');
/*
 * Schema describing required/optional fields of a farm object.
 */
const farmsSchema = {
  name: {required: true},
  address: {required: true},
  farmerIDs: {required: true}
};

function verifyValidFarmID(farmID, mongoDB){
  return new Promise((resolve, reject) => {
    const farmsCollection = mongoDB.collection('farms');
    const _idobj = generateMongoIDQuery(farmID);
    farmsCollection.findOne(_idobj)
      .then((result) => {
        resolve(result);
      })
      .catch((err) =>{
        reject(err);
      });
  });
}
function insertFarm(farmDoc, mongoDB){
  return new Promise((resolve, reject) => {
    const farmsCollection = mongoDB.collection('farms');
    farmsCollection.insertOne(farmDoc)
      .then((result) => {
        resolve(result.insertedId);
      });
  });
}
function updateFarm(farmID, farmDoc, mongoDB){
  return new Promise(function(resolve, reject) {
    const farmsCollection = mongoDB.collection('farms');
    const _idobj = generateMongoIDQuery(farmID);
    farmsCollection.updateOne(_idobj, { $set: farmDoc })
      .then((updated) => {
        resolve(updated.result.n > 0);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getFarmByID(farmID, mongoDB){
  return new Promise(function(resolve, reject) {
    const farmsCollection = mongoDB.collection('farms');
    const _idobj = generateMongoIDQuery(farmID);
    farmsCollection.findOne(_idobj)
      .then((result) => {
        resolve(result);
      })
      .catch((err) =>{
        reject(err);
      });
  });
}
function deleteFarm(farmID, mongoDB){
  return new Promise((resolve, reject) => {
    const farmsCollection = mongoDB.collection('farms');
    const _idobj = generateMongoIDQuery(farmID);
    farmsCollection.deleteOne(_idobj)
      .then((result) => {
        resolve(result.deletedCount > 0);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getAllFarms(mongoDB){
  return new Promise((resolve, reject) => {
    const farmsCollection = mongoDB.collection('farms');
    farmsCollection.find().toArray()
      .then((result) => {
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  });
}


/******************************************************
*				Farms Queries
*******************************************************/
/*
 * Route get a farm by ID
 */
router.get('/', requireAuthentication("test"), function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  getAllFarms(mongoDB)
    .then((farmObject) => {
      if(farmObject){
        res.status(200).json(farmObject);
      }
      else{
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to fetch the farm from the database`
      });
    });
});
/*
 * Route get a farm by ID
 */
router.get('/:farmID', function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const farmID = req.params.farmID;
  getFarmByID(farmID, mongoDB)
    .then((farmObject) => {
      if(farmObject){
        res.status(200).json(farmObject);
      }
      else{
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to fetch the farm from the database`
      });
    });
});
/*
 * Route to post a new farm
 */
router.post('/', function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, farmsSchema) && req.body.farmerIDs.length > 0){
    let farm = validation.extractValidFields(req.body, farmsSchema);
    const mongoDB = req.app.locals.mongoDB;
    insertFarm(farm, mongoDB)
      .then((insertId) => {
        res.status(201).json({
          id: insertId,
          /* Generate HATEOAS links for surrounding pages.*/
          links: {
            farm: `/farms/${insertId}`
          }
        });
      })
      .catch((err) => {
        res.status(500).json({
          err: `Unable to insert the farm in the database`
        });
      });
  }
  else{
    res.status(400).json({
      err: `Request body is not a valid farm object`
    });
  }
});
/*
 * Route to update a farm given the farmID
 */
router.put('/:farmID', function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, farmsSchema) || req.body.farmerIDs.length === 0){
    let farm = validation.extractValidFields(req.body, farmsSchema);
    const farmID = req.params.farmID;
    const mongoDB = req.app.locals.mongoDB;
    verifyValidFarmID(sensorID, mongoDB)
      .then((farmObj) => {
        if (farmObj){
          return updateFarm(farmID, farm, mongoDB);
        } else {
            next();
        }
      })
      .then((numUpdated) => {
        /* if valid farmID, numUpdated == 1 */
        if (numUpdated){
          res.status(200).json({
            id: farmID,
            /* Generate HATEOAS links for surrounding pages.*/
            links: {
              farm: `/farms/${farmID}`
            }
          });
        } else{
          next();
        }
      })
      .catch((err) => {
        res.status(500).json({
          err: `Unable to update the farm in the database`
        });
      });
  }
  else{
    res.status(400).json({
      err: `Request body is not a valid farm object`
    });
  }
});
/*
 * Route to delete a farm.
 */
router.delete('/:farmID', function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const farmID = req.params.farmID;
  deleteFarm(farmID, mongoDB)
    .then((deleteSuccessful) => {
      if (deleteSuccessful) {
        res.status(204).send();
      } else {
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to delete the farm with ID: ${farmID}`
      });
    });
});
