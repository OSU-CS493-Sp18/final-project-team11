const router = require('express').Router();
/* Get Irrigations Schema */
const Ajv = require('ajv');
const ajv = Ajv({allErrors: true});
const schemas = require('../../lib/schemas');
const irrigationsSchema = ajv.compile(schemas.irrigationsSchema);

exports.router = router;
exports.getAvgIrrigationTime = getAvgIrrigationTime
exports.getSensorsLatestIrrigationTime = getSensorsLatestIrrigationTime
exports.getIrrigationByID = getIrrigationByID;

const validation = require('../../lib/validation');
const { generateMongoIDQuery } = require('../../lib/mongoHelpers')
const { getSensorByID } = require('../sensors');
const { requireAuthentication, hasAccessToFarm,
        SENSOR, USER, ADMIN } = require('../../lib/auth');


function getAvgIrrigationTime(listOfIDs, mongoDB){
  return new Promise(function(resolve, reject) {
    const irrigationsCollection = mongoDB.collection('irrigations');
    irrigationsCollection.find( {_id : { $in : listOfIDs } } )
      .toArray()
      .then((result) => {
        if (result.length > 0){
          let sum = result.map(obj => (new Date(obj.timeTurnedOff) - new Date(obj.timeTurnedOn)) ).reduce((prev, next) => prev + next);
          resolve(sum / result.length);
        } else{
          resolve(null);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getSensorsLatestIrrigationTime(sensorID, mongoDB){
  return new Promise(function(resolve, reject) {
    const irrigationCollection = mongoDB.collection('irrigations');
    /* get the most recent record from this sensor */
    irrigationCollection
    .find({sensorID: sensorID})
    .limit(1).sort({$natural:-1})
    .toArray()
      .then((record) => {
        resolve(record);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function insertIrrigation(irrigationDoc, mongoDB){
  return new Promise((resolve, reject) => {
    const irrigationCollection = mongoDB.collection('irrigations');
    irrigationDoc.date = new Date().toISOString();
    irrigationCollection.insertOne(irrigationDoc)
      .then((result) => {
        resolve(result.insertedId);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getIrrigationByID(irrigationID, mongoDB){
  return new Promise(function(resolve, reject) {
    const irrigationCollection = mongoDB.collection('irrigations');
    const _idobj = generateMongoIDQuery(irrigationID);
    irrigationCollection.findOne(_idobj)
      .then((result) => {
        resolve(result);
      })
      .catch((err) =>{
        reject(err);
      });
  });
}
function getAllIrrigations(mongoDB){
  return new Promise((resolve, reject) => {
    const irrigationCollection = mongoDB.collection('irrigations');
    irrigationCollection.find().toArray()
      .then((result) => {
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

/******************************************************
*				Irrigations Queries
*******************************************************/
/*
 * Route to post a new irrigation reading
 */
 router.get('/', function(req, res, next) {
   const mongoDB = req.app.locals.mongoDB;
   getAllIrrigations(mongoDB)
     .then((irrigationObject) => {
       if(irrigationObject){
         res.status(200).json(irrigationObject);
       }
       else{
         next();
       }
     })
     .catch((err) => {
       res.status(500).json({
         error: `Unable to fetch the irrigation from the database`
       });
     });
 });
router.post('/', function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, irrigationsSchema)){
    let irrigationInfo = req.body;
    let sensorID = irrigationInfo.sensorID;
    const mongoDB = req.app.locals.mongoDB;
    let sensorObj = {};

    getSensorByID(sensorID, mongoDB)
      .then((sensorObject) => {
        if (sensorObject) {
          sensorObj = sensorObject;
          const authData = {id:sensorObj.blockID, type:"block", needsRole:SENSOR};
          return hasAccessToFarm(authData, req.farms, mongoDB);
        } else {
          res.status(400).json({
            err: `Request body's sensorID ${sensorID} is not a valid sensor`
          });
        }
      })
      .then((hasAccess) => {
        if (hasAccess){
          /* if the sensor is NOT a irrigation sensor */
          if (sensorObj.type != "irrigation"){
            res.status(400).json({
              err: `Request body's sensorID does not represent a irrigation sensor`
            });
          }/* all good */
          else{
              return insertIrrigation(irrigationInfo, mongoDB);
          }
        } else {
          res.status(403).json({
            err: `User doesn't have access to sensor with id: ${sensorID}`
          });
        }
      })
      .then((insertId) => {
        res.status(201).json({
          id: insertId,
          /* Generate HATEOAS links for surrounding pages.*/
          links: {
            sensor: `/irrigations/${insertId}`
          }
        });
      })
      .catch((err) => {
        res.status(500).json({
          err: `Unable to insert the irrigation into the database`
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
 * Route to get a irrigation reading
 */
 router.get('/:irrigationID', function(req, res, next) {
   const mongoDB = req.app.locals.mongoDB;
   const irrigationID = req.params.irrigationID;
   let irrigationObj = {};

   getIrrigationByID(irrigationID, mongoDB)
     .then((irrigationObject) => {
       if(irrigationObject){
         irrigationObj = irrigationObject;
         const authData = {id:irrigationObj.sensorID,type:"sensor",needsRole:USER};
         return hasAccessToFarm(authData, req.farms, mongoDB);
       } else {
           next();
       }
     })
     .then((hasAccess) => {
       if (hasAccess){
         res.status(200).json(irrigationObject);
       } else {
         res.status(403).json({
           err: `User doesn't have access to this irrigation reading`
         });
       }
     })
     .catch((err) => {
       res.status(500).json({
         error: `Unable to fetch the irrigation from the database`
       });
     });
 });
