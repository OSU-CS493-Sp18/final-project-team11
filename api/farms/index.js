const router = require('express').Router();
/* Get Farms Schema */
const Ajv = require('ajv');
const ajv = Ajv({allErrors: true});
const schemas = require('../../lib/schemas');
const farmsSchema = ajv.compile(schemas.farmsSchema);

exports.router = router;
exports.getFarmByID = getFarmByID;
exports.getFarmsByUsername = getFarmsByUsername;

const validation = require('../../lib/validation');
const { generateMongoIDQuery } = require('../../lib/mongoHelpers');
const { getBlocksInFarm } = require('../blocks');
const { requireAuthentication, hasAccessToFarm,
        SENSOR, USER, ADMIN } = require('../../lib/auth');






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
function getFarmsByUsername(username, mongoDB){
  return new Promise((resolve, reject) => {
    const farmsCollection = mongoDB.collection('farms');
    farmsCollection.find({ authUsers: { $elemMatch: {username: username} } }).toArray()
      .then((result) => {
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
/*
* Bulk update to all users with username in authUsers array.
* The farmID of the new farm and the user's privilege to it
*  is added to the user's authFarms array in their document.
*/
function addFarmToUsers(authUsers, farmID, mongoDB){
  return new Promise((resolve, reject) => {
    const usersCollection = mongoDB.collection('users');
    var bulk = usersCollection.initializeOrderedBulkOp();
    /* turn to string to be consistent, otherwise repeated entries */
    farmID = String(farmID)
    for (var userPriv of authUsers){
      /* If farmID is NOT already preset, add the new document */
      usersCollection
          .updateOne(
            { username: userPriv.username,
              "authFarms.farm": { $ne: farmID }
            },
            { $push:
                { authFarms:
                  {
                    farm: farmID,
                    privilege: userPriv.privilege
                  }
                }
              }, {upsert: false}
          )
          .then((e) => {
            /* If farmID is already preset, just need to update the privilege */
            if (!e.result.n){
              usersCollection.updateOne(
                { username: userPriv.username,
                  "authFarms.farm": { $eq: farmID }
                },
                    { $set:
                        {
                          "authFarms.$.privilege": userPriv.privilege
                        }
                    }, {upsert: false}
                  );
              }
          })
          .catch((e) => {
            reject(err);
          })
    }
    resolve();
  });
}
/******************************************************
*				Farms Queries
*******************************************************/
/*
 * Route get a farm by ID
 */
router.get('/:farmID', requireAuthentication, function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const farmID = req.params.farmID;
  const authNeeded = {id:farmID,type:"farm",needsRole:USER};

  hasAccessToFarm(authNeeded, req.farms, mongoDB, true)
    .then((hasAccess) => {
      if (hasAccess){
        return getFarmByID(farmID, mongoDB);
      } else {
        res.status(403).json({
          err: `User doesn't have authorization to get the farm with id: ${farmID}`
        });
      }
    })
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
 * Route get a all of the blocks associated with the farm ID
 */
router.get('/:farmID/blocks', requireAuthentication, function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const farmID = req.params.farmID;
  const authNeeded = {id:farmID,type:"farm",needsRole:USER};

  hasAccessToFarm(authNeeded, req.farms, mongoDB, true)
    .then((hasAccess) => {
      if (hasAccess){
        return getBlocksInFarm(farmID, mongoDB);
      } else {
        res.status(403).json({
          err: `User doesn't have authorization to get the blocks from the farm with id: ${farmID}`
        });
      }
    })
    .then((blocks) => {
      if(blocks){
        res.status(200).json(blocks);
      }
      else{
        next();
      }
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to fetch the blocks from the database`
      });
    });
});
/*
 * Route to post a new farm
 */
router.post('/', requireAuthentication, function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, farmsSchema)){
    let farm = req.body;
    farm.posterID = req.userID;
    const mongoDB = req.app.locals.mongoDB;
    let insertID = null;
    insertFarm(farm, mongoDB)
      .then((insertId) => {
          insertID = insertId;
          return addFarmToUsers(farm.authUsers, insertId, mongoDB);
      })
      .then(() => {
        res.status(201).json({
          id: insertID,
          /* Generate HATEOAS links for surrounding pages.*/
          links: {
            farm: `/farms/${insertID}`
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
router.put('/:farmID', requireAuthentication, function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, farmsSchema)){
    let farm = req.body
    farm.posterID = req.userID;
    const farmID = req.params.farmID;
    const mongoDB = req.app.locals.mongoDB;
    const authNeeded= {id:farmID,type:"farm",needsRole:USER};

    hasAccessToFarm(authNeeded, req.farms, mongoDB, true)
      .then((hasAccess) => {
        if (hasAccess){
          return updateFarm(farmID, farm, mongoDB);
        } else {
          res.status(403).json({
            err: `User doesn't have authorization to update the farm with id: ${farmID}`
          });
        }
      })
      .then((numUpdated) => {
        /* if valid farmID, numUpdated == 1 */
        if (numUpdated){
          return addFarmToUsers(farm.authUsers, farmID, mongoDB);
        } else {
          next();
        }
      })
      .then(() => {
          res.status(200).json({
            id: farmID,
            /* Generate HATEOAS links for surrounding pages.*/
            links: {
              farm: `/farms/${farmID}`
            }
          });
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
router.delete('/:farmID', requireAuthentication, function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const farmID = req.params.farmID;
  const authNeeded = {id:farmID,type:"farm",needsRole:ADMIN};

  hasAccessToFarm(authNeeded, req.farms, mongoDB, true)
    .then((hasAccess) => {
      if (hasAccess){
        return deleteFarm(farmID, mongoDB);
      } else {
        res.status(403).json({
          err: `User doesn't have authorization to delete the farm with id: ${farmID}`
        });
      }
    })
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
