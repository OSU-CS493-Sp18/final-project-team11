const jwt = require('jsonwebtoken');
const secretKey = process.env.SECRET_KEY;
const SENSOR = 1;
const USER = 2;
const ADMIN = 3;

exports.generateAuthToken = generateAuthToken;
exports.requireAuthentication = requireAuthentication;
exports.hasAccessToFarm = hasAccessToFarm;
exports.SENSOR = SENSOR;
exports.USER = USER;
exports.ADMIN = ADMIN;

const { generateMongoIDQuery } = require('./mongoHelpers');
const { getSensorByID } = require('../api/sensors');
const { getBlockByID } = require('../api/blocks');
const { getTemperatureByID } = require('../api/temperatures');
const { getSoilByID } = require('../api/soils');
const { getIrrigationByID } = require('../api/irrigations');





function generateAuthToken(username, userID, farms) {
  return new Promise((resolve, reject) => {
    const payload = { sub: username, id: userID, farms: farms};
    jwt.sign(payload, secretKey, { expiresIn: '24h' }, function (err, token) {
      if (err) {
        reject(err);
      } else {
        resolve(token);
      }
    });
  });
}

function requireAuthentication (req, res, next) {
  const authHeader = req.get('Authorization') || '';
  const authHeaderParts = authHeader.split(' ');
  const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null;
  jwt.verify(token, secretKey, function (err, payload) {
    if (err) {
      res.status(401).json({
        error: "Invalid authentication token"
      });
    } else {
      req.username = payload.sub;
      req.userID = payload.id;
      req.farms = payload.farms ? payload.farms : [];
      next();
    }
  });
}
/*
* Returs the farmID that the block is from
*/
function getFarmIDFromBlockID(blockID, mongoDB){
  return new Promise(function(resolve, reject) {
    const blocksCollection = mongoDB.collection('blocks');
    const _idobj = generateMongoIDQuery(blockID);
    blocksCollection.findOne(_idobj)
    .then((record) => {
      if (record){
        resolve(record.farmID);
      }
        resolve(false);
    })
    .catch((err) => {
        reject(err);
    });
  });

}
/*
* Returs the farmID that the sensor is from
*/
function getFarmIDFromSensorID(sensorID, mongoDB){
  return new Promise(function(resolve, reject) {
    getSensorByID(sensorID, mongoDB)
      .then((sensorObj) => {
        if (sensorObj){
          return getBlockByID(sensorObj.blockID, mongoDB);
        } else {
          return resolve(false);
        }
      })
      .then((blockObj) => {
        if (blockObj) {
          return resolve(blockObj.farmID);
        } else {
          return resolve(false);
        }
      })
      .catch((err) => {
        return reject(err);
      })
    });
}
/*
* Returs the farmID that the temperature is from
*/
function getFarmIDFromTemperatureID(tempID, mongoDB){
  return new Promise(function(resolve, reject) {
    getTemperatureByID(tempID, mongoDB)
      .then((tempObj) => {
        if (tempObj) {
          return getSensorByID(tempObj.sensorID, mongoDB);
        } else {
          return resolve(false);
        }
      })
      .then((sensorObj) => {
        if (sensorObj){
          return getBlockByID(sensorObj.blockID, mongoDB);
        } else {
          return resolve(false);
        }
      })
      .then((blockObj) => {
        if (blockObj) {
          return resolve(blockObj.farmID);
        } else {
          return resolve(false);
        }
      })
      .catch((err) => {
        return reject(err);
      })
    });
}
/*
* Returs the farmID that the soil is from
*/
function getFarmIDFromSoilID(soilID, mongoDB){
  return new Promise(function(resolve, reject) {
    getSoilByID(soilID, mongoDB)
      .then((soilObj) => {
        if (soilObj) {
          return getSensorByID(soilObj.sensorID, mongoDB);
        } else {
          return resolve(false);
        }
      })
      .then((sensorObj) => {
        if (sensorObj){
          return getBlockByID(sensorObj.blockID, mongoDB);
        } else {
          return resolve(false);
        }
      })
      .then((blockObj) => {
        if (blockObj) {
          return resolve(blockObj.farmID);
        } else {
          return resolve(false);
        }
      })
      .catch((err) => {
        return reject(err);
      })
    });
}
/*
* Returs the farmID that the irrigation is from
*/
function getFarmIDFromIrrigationID(irriID, mongoDB){
  return new Promise(function(resolve, reject) {
    getIrrigationByID(irriID, mongoDB)
      .then((irriObj) => {
        if (irriObj) {
          return getSensorByID(soilObj.sensorID, mongoDB)
        } else {
          resolve(false);
        }
      })
      .then((sensorObj) => {
        if (sensorObj){
          return getBlockByID(sensorObj.blockID, mongoDB);
        } else {
          resolve(false);
        }
      })
      .then((blockObj) => {
        if (blockObj) {
          resolve(blockObj.farmID);
        } else {
          resolve(false);
        }
      })
      .catch((err) => {
        reject(err);
      })
    });
}
/*
* Three tiers of prevlidges:
*   1 = for sensors, can only post to temperature, soil, irrigation
*   2 = for users, can post, put, get (Not delete)
*   3 = for farm admin
*/
function isSufficientPrivledge(farmID, userAuthFarms, needsRole){
  return new Promise(function(resolve, reject) {
    if (userAuthFarms){
      let farmAndPriv = userAuthFarms.find((o) => {
        if (o.farm == farmID){
          return true;
        }
      });

      if (farmAndPriv && (farmAndPriv.privilege >= needsRole))
        resolve(true);
    }
    resolve(false);
  });
}
/*
* Given a either a blockID or a farmID and an array of [ FarmIDs ],
*  this function gets the block document corresponding to the blockID
*  it is supplied, then returns True if the block's FarmID is in
*  the supplied array of [ FarmIDs ].
*/
function hasAccessToFarm(authNeeded, userAuthFarms, mongoDB){
  return new Promise(function(resolve, reject) {
    if (authNeeded && userAuthFarms){
      const id = authNeeded.id;
      const type = authNeeded.type;
      const needsRole = authNeeded.needsRole;
      const extractFarmIDFuncs = {
        "farm": (id, mongoDB) => {return Promise.resolve(id);},
        "block": getFarmIDFromBlockID,
        "sensor": getFarmIDFromSensorID,
        "temperature": getFarmIDFromTemperatureID,
        "soil": getFarmIDFromSoilID,
        "irrigation": getFarmIDFromIrrigationID,
        "default": (id, mongoDB) => {return Promise.resolve(null)}
      };

      (extractFarmIDFuncs[type] || extractFarmIDFuncs['default'])(id, mongoDB)
        .then((farmID) => {
          return isSufficientPrivledge(farmID, userAuthFarms, needsRole);
        })
        .then((isSuff) => {
          resolve(isSuff);
        })
        .catch((err) => {reject(err)} );
    } else {
        resolve(false);
    }
  });
}
