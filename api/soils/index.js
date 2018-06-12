const router = require('express').Router();
/* Get Soils Schema */
const Ajv = require('ajv');
const ajv = Ajv({allErrors: true});
const schemas = require('../../lib/schemas');
const soilsSchema = ajv.compile(schemas.soilsSchema);

exports.router = router;
exports.getAvgSoilData = getAvgSoilData
exports.getSensorsLatestSoilData = getSensorsLatestSoilData
exports.getSoilByID = getSoilByID;

const validation = require('../../lib/validation');
const { generateMongoIDQuery } = require('../../lib/mongoHelpers')
const { getSensorByID } = require('../sensors');
const { requireAuthentication, hasAccessToFarm,
        SENSOR, USER, ADMIN } = require('../../lib/auth');



function getAvgSoilData(listOfSensorIDs, mongoDB){
  return new Promise(function(resolve, reject) {
    const soilsCollection = mongoDB.collection('soils');
    const oneDay = 24 * 60 * 60 * 1000;
    const past24Hrs =  new Date((new Date).getTime() - (oneDay));
    soilsCollection
      .find( {
          sensorID: { $in : listOfSensorIDs },
          date: {$gte: past24Hrs}

      } )
      .toArray()
      .then((result) => {
        if (result.length > 0){
          let sum = result.map(obj => obj.soilTemp.magnitude).reduce((prev, next) => prev + next);
          let avgSoilData = {};
           avgSoilData.avgSoilTemp = {
            magnitude: sum / result.length,
            units: "fahrenheit"
          };
          resolve(avgSoilData);
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
// function getAllSoils(mongoDB){
//   return new Promise((resolve, reject) => {
//     const soilCollection = mongoDB.collection('soils');
//     soilCollection.find().toArray()
//       .then((result) => {
//         resolve(result);
//       })
//       .catch((err) => {
//         reject(err);
//       });
//   });
// }

/******************************************************
*				Soils Queries
*******************************************************/
/*
 * Route to post a new soil reading
 */
 // router.get('/', function(req, res, next) {
 //   const mongoDB = req.app.locals.mongoDB;
 //   getAllSoils(mongoDB)
 //     .then((soilObject) => {
 //       if(soilObject){
 //         res.status(200).json(soilObject);
 //       }
 //       else{
 //         next();
 //       }
 //     })
 //     .catch((err) => {
 //       res.status(500).json({
 //         error: `Unable to fetch the soil from the database`
 //       });
 //     });
 // });
router.post('/', requireAuthentication, function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, soilsSchema)){
    let soilInfo = req.body;
    let sensorID = soilInfo.sensorID;
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
          /* if the sensor is NOT a soil sensor */
          if (sensorObj.type != "soil"){
            res.status(400).json({
              err: `Request body's sensorID does not represent a soil sensor`
            });
          }/* all good */
          else{
              return insertSoil(soilInfo, mongoDB);
          }
        } else {
          res.status(403).json({
            err: `User doesn't have authorization to sensor with id: ${sensorID}`
          });
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
 router.get('/:soilID', requireAuthentication, function(req, res, next) {
   const mongoDB = req.app.locals.mongoDB;
   const soilID = req.params.soilID;
   let soilObj = {};

   getSoilByID(soilID, mongoDB)
     .then((soilObject) => {
       if(soilObject){
         soilObj = soilObject;
         const authData = {id:soilObj.sensorID,type:"sensor",needsRole:USER};
         return hasAccessToFarm(authData, req.farms, mongoDB);
       } else {
           next();
       }
     })
     .then((hasAccess) => {
       if (hasAccess){
         res.status(200).json(soilObject);
       } else {
         res.status(403).json({
           err: `User doesn't have authorization to this soil reading`
         });
       }
     })
     .catch((err) => {
       res.status(500).json({
         error: `Unable to fetch the soil from the database`
       });
     });
 });
