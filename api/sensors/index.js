const router = require('express').Router();
exports.router = router;
exports.getSensorsInBlock = getSensorsInBlock;
exports.verifyValidSensorID = verifyValidSensorID;

const validation = require('../../lib/validation');
const { generateMongoIDQuery } = require('../../lib/mongoHelpers');
const { getSensorsLatestTemp } = require('../temperatures');
const { getSensorsLatestSoilData } = require('../soils');
const { verifyValidBlockID } = require('../blocks');


/*
 * Schema describing required/optional fields of a business object.
 */
const sensorsSchema = {
  blockID: {required: true},
  type: {required: true},
  location: {required: true}
};
/*
* The type of sensors a sensor can be
*/
const sensorTypes = [
  "temperature",
  "soil"
];

function verifyValidSensorID(sensorID, mongoDB){
  return new Promise((resolve, reject) => {
    const sensorsCollection = mongoDB.collection('sensors');
    const _idobj = generateMongoIDQuery(sensorID);
    sensorsCollection.findOne(_idobj)
      .then((result) => {
        resolve(result);
      })
      .catch((err) =>{
        reject(err);
      });
  });
}
function getSensorsInBlock(blockID, mongoDB){
  return new Promise(function(resolve, reject) {
    const sensorsCollection = mongoDB.collection('sensors');
    sensorsCollection
      .find({blockID: blockID})
      .toArray()
      .then((result) => {
        resolve(result)
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function insertSensor(sensorDoc, mongoDB){
  return new Promise((resolve, reject) => {
    const sensorsCollection = mongoDB.collection('sensors');
    sensorsCollection.insertOne(sensorDoc)
      .then((result) => {
        resolve(result.insertedId);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function updateSensor(sensorID, sensorDoc, mongoDB){
  return new Promise(function(resolve, reject) {
    const sensorsCollection = mongoDB.collection('sensors');
    const _idobj = generateMongoIDQuery(sensorID);
    const newValues = { $set: sensorDoc };
    sensorsCollection.updateOne(_idobj, newValues)
      .then((updated) => {
        resolve(updated.result.n > 0);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getSensorByID(sensorID, mongoDB){
  return new Promise(function(resolve, reject) {
    const sensorsCollection = mongoDB.collection('sensors');
    const _idobj = generateMongoIDQuery(sensorID);
    sensorsCollection.findOne(_idobj)
      .then((result) => {
        resolve(result);
      })
      .catch((err) =>{
        reject(err);
      });
  });
}
function deleteSensor(sensorID, mongoDB){
  return new Promise((resolve, reject) => {
    const sensorsCollection = mongoDB.collection('sensors');
    const _idobj = generateMongoIDQuery(sensorID);
    sensorsCollection.deleteOne(_idobj)
      .then((result) => {
        resolve(result.deletedCount > 0);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getAllSensors(mongoDB){
  return new Promise((resolve, reject) => {
    const sensorsCollection = mongoDB.collection('sensors');
    sensorsCollection.find().toArray()
      .then((result) => {
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
/******************************************************
*				Sensors Queries
*******************************************************/
/*
 * Route get a sensor by ID
 */
router.get('/', function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  getAllSensors(mongoDB)
    .then((sensorObject) => {
      if(sensorObject){
        res.status(200).json(sensorObject);
      }
      else{
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to fetch the sensor from the database`
      });
    });
});
/*
 * Route to get a sensor by ID
 */
router.get('/:sensorID', function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const sensorID = req.params.sensorID;
  getSensorByID(sensorID, mongoDB)
    .then((sensorObject) => {
      if(sensorObject){
        res.status(200).json(sensorObject);
      } else {
          next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to fetch the sensor from the database`
      });
    });
});
/*
 * Route to post a new sensor
 */
router.post('/', function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, sensorsSchema) && sensorTypes.indexOf(req.body.type) > -1){
    let sensor = validation.extractValidFields(req.body, sensorsSchema);
    const blockID = sensor.blockID;
    const mongoDB = req.app.locals.mongoDB;
    verifyValidBlockID(blockID, mongoDB)
      .then((isValid) => {
        if(isValid){
          return insertSensor(sensor, mongoDB);
        } else{
          res.status(400).json({
            err: `Request body's blockID ${blockID} is not a valid block`
          });
        }
      })
      .then((insertId) => {
        res.status(201).json({
          id: insertId,
          /* Generate HATEOAS links for surrounding pages.*/
          links: {
            sensor: `/sensors/${insertId}`
          }
        });
      })
      .catch((err) => {
        res.status(500).json({
          err: `Unable to insert the sensor in the database`
        });
      });
  }
  else{
    if (sensorTypes.indexOf(req.body.type) === -1){
      res.status(400).json({
        err: `Request body has an invalid sensor type`
      });
    } else {
        res.status(400).json({
          err: `Request body is not a valid sensor object`
        });
      }
    }
});
/*
 * Route to update a sensor given the sensorID
 */
router.put('/:sensorID', function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, sensorsSchema)){
    let sensor = validation.extractValidFields(req.body, sensorsSchema);
    const blockID = sensor.blockID;
    const sensorID = req.params.sensorID;
    const mongoDB = req.app.locals.mongoDB;
    verifyValidBlockID(blockID, mongoDB)
      .then((isValid) => {
        if(isValid){
          return updateSensor(sensorID, sensor, mongoDB);
        } else{
          res.status(400).json({
            err: `Request body's blockID ${blockID} is not a valid block`
          });
        }
      })
      .then((numUpdated) => {
        /* if valid sensorID, numUpdated == 1 */
        if (numUpdated){
          res.status(200).json({
            id: sensorID,
            /* Generate HATEOAS links for surrounding pages.*/
            links: {
              sensor: `/sensors/${sensorID}`
            }
          });
        } else{
          next();
        }
      })
      .catch((err) => {
        res.status(500).json({
          err: `Unable to update the sensor in the database`
        });
      });
  }
  else{
    res.status(400).json({
      err: `Request body is not a valid sensor object`
    });
  }
});
/*
 * Route to delete a sensor.
 */
router.delete('/:sensorID', function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const sensorID = req.params.sensorID;
  deleteSensor(sensorID, mongoDB)
    .then((deleteSuccessful) => {
      if (deleteSuccessful) {
        res.status(204).send();
      } else {
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to delete the sensor with ID: ${sensorID}`
      });
    });
});
/*
 * Route to get the current temperature of a sensor.
 */
router.get('/:sensorID/temperature', function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const sensorID = req.params.sensorID;
  verifyValidSensorID(sensorID, mongoDB)
    .then((sensorObj) => {
      if (sensorObj){
        return getSensorsLatestTemp(sensorID, mongoDB);
      } else {
          next();
      }
    })
    .then((latestRecord) => {
      res.status(200).json(latestRecord);
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to get the latest temperature for sensor with ID: ${sensorID}`
      });
    });
});
/*
 * Route to get the current soil data of a sensor.
 */
router.get('/:sensorID/soil', function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const sensorID = req.params.sensorID;
  verifyValidSensorID(sensorID, mongoDB)
    .then((sensorObj) => {
      if (sensorObj){
        return getSensorsLatestSoilData(sensorID, mongoDB);
      } else {
          next();
      }
    })
    .then((latestRecord) => {
      res.status(200).json(latestRecord);
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to get the latest soil data for sensor with ID: ${sensorID}`
      });
    });
});
