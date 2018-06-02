const router = require('express').Router();
exports.router = router;
exports.getAvgTempFromSensorIDs = getAvgTempFromSensorIDs;
exports.getSensorsLatestTemp = getSensorsLatestTemp;

const validation = require('../../lib/validation');
const { generateMongoIDQuery } = require('../../lib/mongoHelpers');
const { verifyValidSensorID } = require('../sensors');
/*
 * Schema describing required/optional fields of a business object.
 */
const temperaturesSchema = {
  sensorID: {required: true},
  magnitude: {required: true},
  units: {required: true},
  date: {required: false}
};




function getAvgTempFromSensorIDs(listOfSensorIDs, mongoDB){
  return new Promise(function(resolve, reject) {
    const tempCollection = mongoDB.collection('temperatures');
    let thePast24Hs =  new Date((new Date).getTime() - (24 * 60 * 60 * 1000));
    tempCollection
      .find( {
          sensorID: { $in : listOfSensorIDs },
          date: {$gte: thePast24Hs}
      } )
      .toArray()
      .then((result) => {
        if (result.length > 0){
          let sum = result.map(obj => obj.magnitude).reduce((prev, next) => prev + next);
          resolve( (sum / result.length).toFixed(2) );
        } else{
          resolve(null);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getSensorsLatestTemp(sensorID, mongoDB){
  return new Promise(function(resolve, reject) {
    const tempCollection = mongoDB.collection('temperatures');
    /* get the most recent record from this sensor */
    tempCollection
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
function insertTemperature(tempDoc, mongoDB){
  return new Promise((resolve, reject) => {
    const tempCollection = mongoDB.collection('temperatures');
    tempDoc.date = new Date();
    tempCollection.insertOne(tempDoc)
      .then((result) => {
        resolve(result.insertedId);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function updateTemperature(tempID, tempDoc, mongoDB){
  return new Promise(function(resolve, reject) {
    const tempCollection = mongoDB.collection('temperatures');
    const _idobj = generateMongoIDQuery(tempID);
    tempDoc.date = new Date();
    tempCollection.updateOne(_idobj, { $set: tempDoc })
      .then((updated) => {
        resolve(updated.result.n > 0);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getTemperatureByID(tempID, mongoDB){
  return new Promise(function(resolve, reject) {
    const tempCollection = mongoDB.collection('temperatures');
    const _idobj = generateMongoIDQuery(tempID);
    tempCollection.findOne(_idobj)
      .then((result) => {
        resolve(result);
      })
      .catch((err) =>{
        reject(err);
      });
  });
}
function getAllTemps(mongoDB){
  return new Promise((resolve, reject) => {
    const sensorsCollection = mongoDB.collection('temperatures');
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
*				Temperatures Queries
*******************************************************/
/*
 * Route to post a new temperature reading
 */
 router.get('/', function(req, res, next) {
   const mongoDB = req.app.locals.mongoDB;
   getAllTemps(mongoDB)
     .then((tempObject) => {
       if(tempObject){
         res.status(200).json(tempObject);
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
router.post('/', function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, temperaturesSchema)){
    let tempInfo = validation.extractValidFields(req.body, temperaturesSchema);
    let sensorID = tempInfo.sensorID;
    const mongoDB = req.app.locals.mongoDB;
    verifyValidSensorID(sensorID, mongoDB)
      .then((sensorObj) => {
        /* if the sensor is NOT a valid sensor */
        if(!sensorObj){
          res.status(400).json({
            err: `Request body's sensorID ${sensorID} is not a valid sensor`
          });
        }/* if the sensor is NOT a temperature sensor */
        else if (sensorObj.type != "temperature"){
          res.status(400).json({
            err: `Request body's sensorID does not represent a temperature sensor`
          });
        }/* all good */
        else{
            return insertTemperature(tempInfo, mongoDB);
        }
      })
      .then((insertId) => {
        res.status(201).json({
          id: insertId,
          /* Generate HATEOAS links for surrounding pages.*/
          links: {
            sensor: `/temperatures/${insertId}`
          }
        });
      })
      .catch((err) => {
        res.status(500).json({
          err: `Unable to insert the temperature into the database`
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
 * Route to get a temperature reading
 */
 router.get('/:tempID', function(req, res, next) {
   const mongoDB = req.app.locals.mongoDB;
   const tempID = req.params.tempID;
   getTemperatureByID(tempID, mongoDB)
     .then((tempObject) => {
       if(tempObject){
         res.status(200).json(tempObject);
       } else {
           next();
       }
     })
     .catch((err) => {
       res.status(500).json({
         error: `Unable to fetch the temperature from the database`
       });
     });
 });

 // router.put('/:tempID', function(req, res, next) {
 //   if (validation.validateAgainstSchema(req.body, temperaturesSchema)){
 //     let tempInfo = validation.extractValidFields(req.body, temperaturesSchema);
 //     let sensorID = tempInfo.sensorID;
 //     const tempID = req.params.tempID;
 //     const mongoDB = req.app.locals.mongoDB;
 //     verifyValidSensorID(sensorID, mongoDB)
 //       .then((sensorObj) => {
 //         /* if the sensor is NOT a valid sensor */
 //         if(!sensorObj){
 //           res.status(400).json({
 //             err: `Request body's sensorID ${sensorID} is not a valid sensor`
 //           });
 //         }/* if the sensor is NOT a temperature sensor */
 //         else if (sensorObj.type != "temperature"){
 //           res.status(400).json({
 //             err: `Request body's sensorID does not represent a temperature sensor`
 //           });
 //         }/* all good */
 //         else{
 //             return updateTemperature(tempID, tempInfo, mongoDB);
 //         }
 //       })
 //       .then((numUpdated) => {
 //         /* if valid tempID, numUpdated == 1 */
 //         if (numUpdated){
 //           res.status(200).json({
 //             id: tempID,
 //             /* Generate HATEOAS links for surrounding pages.*/
 //             links: {
 //               block: `/temperatures/${tempID}`
 //             }
 //           });
 //         } else{
 //           next();
 //         }
 //       })
 //       .catch((err) => {
 //         res.status(500).json({
 //           err: `Unable to insert the temperature into the database`
 //         });
 //       });
 //   }
 //   else{
 //       res.status(400).json({
 //         err: `Request body is not a valid sensor object`
 //       });
 //     }
 // });
