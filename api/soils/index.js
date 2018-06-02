const router = require('express').Router();
exports.router = router;
exports.getAvgSoilData = getAvgSoilData
exports.getSensorsLatestSoilData = getSensorsLatestSoilData

const validation = require('../../lib/validation');
const { generateMongoIDQuery } = require('../../lib/mongoHelpers')
const { verifyValidSensorID } = require('../sensors');

/*
 * Schema describing required/optional fields of a business object.
 */
const soilsSchema = {
  sensorID: {required: true},
  soilTemp: {required: false},
  eConductivity: {required: false},
  volumetricWater: {required: false},
  date: {required: false}
};

function getAvgSoilData(listOfIDs, mongoDB){
  return new Promise(function(resolve, reject) {
    const soilsCollection = mongoDB.collection('soils');
    soilsCollection.find( {_id : { $in : listOfIDs } } )
      .toArray()
      .then((result) => {
        if (result.length > 0){
          let sum = result.map(obj => obj.magnitude).reduce((prev, next) => prev + next);
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
function getSensorsLatestSoilData(sensorID, mongoDB){
  return new Promise(function(resolve, reject) {
    const soilCollection = mongoDB.collection('soils');
    /* get the most recent record from this sensor */
    soilCollection
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
function insertSoil(soilDoc, mongoDB){
  return new Promise((resolve, reject) => {
    const soilCollection = mongoDB.collection('soils');
    soilDoc.date = new Date();
    soilCollection.insertOne(soilDoc)
      .then((result) => {
        resolve(result.insertedId);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function updateSoil(soilID, soilDoc, mongoDB){
  return new Promise(function(resolve, reject) {
    const soilCollection = mongoDB.collection('soils');
    const _idobj = generateMongoIDQuery(soilID);
    soilDoc.date = new Date();
    soilCollection.updateOne(_idobj, { $set: soilDoc })
      .then((updated) => {
        resolve(updated.result.n > 0);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getSoilByID(soilID, mongoDB){
  return new Promise(function(resolve, reject) {
    const soilCollection = mongoDB.collection('soils');
    const _idobj = generateMongoIDQuery(soilID);
    soilCollection.findOne(_idobj)
      .then((result) => {
        resolve(result);
      })
      .catch((err) =>{
        reject(err);
      });
  });
}
function getAllSoils(mongoDB){
  return new Promise((resolve, reject) => {
    const soilCollection = mongoDB.collection('soils');
    soilCollection.find().toArray()
      .then((result) => {
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

/******************************************************
*				Soils Queries
*******************************************************/
/*
 * Route to post a new soil reading
 */
 router.get('/', function(req, res, next) {
   const mongoDB = req.app.locals.mongoDB;
   getAllSoils(mongoDB)
     .then((soilObject) => {
       if(soilObject){
         res.status(200).json(soilObject);
       }
       else{
         next();
       }
     })
     .catch((err) => {
       res.status(500).json({
         error: `Unable to fetch the soil from the database`
       });
     });
 });
router.post('/', function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, soilsSchema)){
    let soilInfo = validation.extractValidFields(req.body, soilsSchema);
    let sensorID = soilInfo.sensorID;
    const mongoDB = req.app.locals.mongoDB;
    verifyValidSensorID(sensorID, mongoDB)
      .then((sensorObj) => {
        /* if the sensor is NOT a valid sensor */
        if(!sensorObj){
          res.status(400).json({
            err: `Request body's sensorID ${sensorID} is not a valid sensor`
          });
        }/* if the sensor is NOT a soil sensor */
        else if (sensorObj.type != "soil"){
          res.status(400).json({
            err: `Request body's sensorID does not represent a soil sensor`
          });
        }/* all good */
        else{
            return insertSoil(soilInfo, mongoDB);
        }
      })
      .then((insertId) => {
        res.status(201).json({
          id: insertId,
          /* Generate HATEOAS links for surrounding pages.*/
          links: {
            sensor: `/soils/${insertId}`
          }
        });
      })
      .catch((err) => {
        res.status(500).json({
          err: `Unable to insert the soil into the database`
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
 * Route to get a soil reading
 */
 router.get('/:soilID', function(req, res, next) {
   const mongoDB = req.app.locals.mongoDB;
   const soilID = req.params.soilID;
   getSoilByID(soilID, mongoDB)
     .then((soilObject) => {
       if(soilObject){
         res.status(200).json(soilObject);
       } else {
           next();
       }
     })
     .catch((err) => {
       res.status(500).json({
         error: `Unable to fetch the soil from the database`
       });
     });
 });
