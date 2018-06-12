const router = require('express').Router();
/* Get Blocks Schema */
const Ajv = require('ajv');
const ajv = Ajv({allErrors: true});
const schemas = require('../../lib/schemas');
const blocksSchema = ajv.compile(schemas.blocksSchema);

exports.router = router;
exports.getBlockByID = getBlockByID;
exports.getBlocksInFarm = getBlocksInFarm;

const validation = require('../../lib/validation');
const { generateMongoIDQuery } = require('../../lib/mongoHelpers');
const { getFarmByID } = require('../farms');
const { getSensorsInBlock } = require('../sensors');
const { getAvgSoilData } = require('../soils');
const { getAvgIrrigationTime } = require('../irrigations');
const { getAvgTempFromSensorIDs } = require('../temperatures');
const { requireAuthentication, hasAccessToFarm,
        SENSOR, USER, ADMIN } = require('../../lib/auth');




function insertBlock(blockDoc, mongoDB){
  return new Promise((resolve, reject) => {
    const blocksCollection = mongoDB.collection('blocks');
    blocksCollection.insertOne(blockDoc)
      .then((result) => {
        resolve(result.insertedId);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function updateBlock(blockID, blockDoc, mongoDB){
  return new Promise(function(resolve, reject) {
    const blocksCollection = mongoDB.collection('blocks');
    const _idobj = generateMongoIDQuery(blockID);
    const newValues = { $set: blockDoc };
    blocksCollection.updateOne(_idobj, newValues)
      .then((updated) => {
        resolve(updated.result.n > 0);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getBlockByID(blockID, mongoDB){
  return new Promise(function(resolve, reject) {
    const blocksCollection = mongoDB.collection('blocks');
    const _idobj = generateMongoIDQuery(blockID);
    blocksCollection.findOne(_idobj)
      .then((result) => {
        resolve(result);
      })
      .catch((err) =>{
        reject(err);
      });
  });
}
function deleteBlock(blockID, mongoDB){
  return new Promise((resolve, reject) => {
    const blocksCollection = mongoDB.collection('blocks');
    const _idobj = generateMongoIDQuery(blockID);
    blocksCollection.deleteOne(_idobj)
      .then((result) => {
        resolve(result.deletedCount > 0);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getBlocksInFarm(farmID, mongoDB){
  return new Promise((resolve, reject) => {
    const blocksCollection = mongoDB.collection('blocks');
    blocksCollection.find( {farmID: farmID} ).toArray()
      .then((result) => {
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
function getPageSensors(reqPage, sensorsLength){
  /*
  * Compute page number based on optional query string parameter `page`.
  * Make sure page is within allowed bounds.
  */
  let page = reqPage || 1;
  const numPerPage = 10;
  const lastPage = Math.ceil(sensorsLength / numPerPage);
  page = page < 1 ? 1 : page;
  page = page > lastPage ? lastPage : page;

  /* Calculate starting and ending indices of blocks on requested page */
  const start = (page - 1) * numPerPage;
  const end = start + numPerPage;
  return { "start": start,
           "end": end,
           "lastPage": lastPage,
           'pageNumber': page
         };
}

/******************************************************
*				Blocks Queries
*******************************************************/
/*
 * Route to get a block by ID
 * returns block object, all sensor IDs in that block,
 *  current average air temperature, soil data, and irrigation data
 */
router.get('/:blockID', requireAuthentication, function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const blockID = req.params.blockID;
  let retObj = {};
  /* used to extract ids of sensors to get the avergae temp, soil, and irrigation
      data in the block */
  let allSensorsInBlock = [];

  getBlockByID(blockID, mongoDB)
    .then((blockObject) => {
      if(blockObject){
        retObj = blockObject;
        const authData = {id:blockObject.farmID,type:"farm",needsRole:USER};
        return hasAccessToFarm(authData, req.farms, mongoDB);
      } else {
          next();
      }
    })
    .then((hasAccess) => {
      if (hasAccess){
        return getSensorsInBlock(blockID, mongoDB);
      } else {
        res.status(403).json({
          err: `User doesn't have access to block with id: ${blockID}`
        });
      }
    })
     .then((sensorsInBlock) => {
       allSensorsInBlock = (sensorsInBlock || [])
       let {
         start,
         end,
         lastPage,
         pageNumber
       } = getPageSensors(parseInt(req.query.page), sensorsInBlock.length);
       /* SPLICE */
       const pageSensors = sensorsInBlock.slice(start, end);
       retObj.pageSensors = pageSensors

       /* Generate HATEOAS links for surrounding pages.*/
       retObj.links = {};
       if (pageNumber < lastPage) {
         retObj.links.nextPage = `/blocks/${blockID}?page=` + (pageNumber + 1);
         retObj.links.lastPage = `/blocks/${blockID}?page=` + lastPage;
       }
       if (pageNumber > 1) {
         retObj.links.prevPage = `/blocks/${blockID}?page=` + (pageNumber - 1);
         retObj.links.firstPage = `/blocks/${blockID}?page=1`;
       }
       /* extract ids of temperature sensors */
       let tempSensorIDs = allSensorsInBlock.map(obj => {
         if(obj.type === "temperature"){
           return obj._id.toString();
         }
       });
       if (tempSensorIDs.length > 0){
         return getAvgTempFromSensorIDs(tempSensorIDs, mongoDB);
       } else {
         return Promise.resolve(null);
       }
     })
    .then((avgTemp) => {
      if (avgTemp != null){
        retObj.avgTemp = avgTemp;
      }
      /* extract ids of soil data from sensors */
      let soilSensorIDs = allSensorsInBlock.map(obj => {
        if(obj.type === "soil"){
          return obj._id.toString();
        }
      });
      if (soilSensorIDs.length > 0) {
        return getAvgSoilData(soilSensorIDs, mongoDB);
      } else {
        return Promise.resolve(null);
      }
    })
    .then((avgSoilData) => {
      if (avgSoilData != null){
        retObj.avgSoilData = avgSoilData;
      }
      /* extract ids of irrigation data from sensors */
      let irriSensorIDs = allSensorsInBlock.map(obj => {
        if(obj.type === "irrigation"){
          return obj._id.toString();
        }
      });
      if (irriSensorIDs.length > 0) {
        return getAvgIrrigationTime(irriSensorIDs, mongoDB);
      } else {
        return Promise.resolve(null);
      }
    })
    .then((avgWaterTime) => {
      if (avgWaterTime != null){
        retObj.avgWaterTime = avgWaterTime;
      }
      res.status(200).json(retObj);
    })
    .catch((err) => {
      res.status(500).json({
        error: `Unable to fetch the block from the database`
      });
    });
});
/*
 * Route to post a new block
 */
router.post('/', requireAuthentication, function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, blocksSchema)){
    let block = req.body;
    block.posterID = req.userID;
    const farmID = block.farmID;
    const mongoDB = req.app.locals.mongoDB;
    const authData = {id:farmID,type:"farm",needsRole:USER};

    hasAccessToFarm(authData, req.farms, mongoDB, true)
      .then((hasAccess) => {
        if (hasAccess){
          return getFarmByID(farmID, mongoDB);
        } else {
          res.status(403).json({
            err: `User doesn't have access to farm with id: ${farmID}`
          });
        }
      })
      .then((isValid) => {
        if(isValid){
          return insertBlock(block, mongoDB);
        } else{
          res.status(400).json({
            err: `Request body's farmID ${farmID} is not a valid farm`
          });
        }
      })
      .then((insertId) => {
        res.status(201).json({
          id: insertId,
          /* Generate HATEOAS links for surrounding pages.*/
          links: {
            block: `/blocks/${insertId}`
          }
        });
      })
      .catch((err) => {
        res.status(500).json({
          err: `Unable to insert the block in the database`
        });
      });
  }
  else{
    res.status(400).json({
      err: `Request body is not a valid block object`
    });
  }
});
/*
 * Route to update a block given the blockID
 */
router.put('/:blockID', requireAuthentication, function(req, res, next) {
  if (validation.validateAgainstSchema(req.body, blocksSchema)){
    let block = req.body;
    block.posterID = req.userID;
    const blockID = req.params.blockID;
    const mongoDB = req.app.locals.mongoDB;
    const authData = {id:block.farmID,type:"farm",needsRole:USER};

    hasAccessToFarm(authData, req.farms, mongoDB)
      .then((hasAccess) => {
        if (hasAccess){
          return getFarmByID(block.farmID, mongoDB)
        } else {
          res.status(403).json({
            err: `User doesn't have access to block with id: ${blockID}`
          });
        }
      })
      .then((isValid) => {
        if(isValid){
          return updateBlock(blockID, block, mongoDB);
        } else{
          res.status(400).json({
            err: `Request body's farmID ${farmID} is not a valid farm`
          });
        }
      })

      .then((numUpdated) => {
        /* if valid blockID, numUpdated == 1 */
        if (numUpdated){
          res.status(200).json({
            id: blockID,
            /* Generate HATEOAS links for surrounding pages.*/
            links: {
              block: `/blocks/${blockID}`
            }
          });
        } else{
          next();
        }
      })
      .catch((err) => {
        res.status(500).json({
          err: `Unable to update the block in the database`
        });
      });
  }
  else{
    res.status(400).json({
      err: `Request body is not a valid block object`
    });
  }
});
/*
 * Route to delete a block.
 */
router.delete('/:blockID', requireAuthentication, function(req, res, next) {
  const mongoDB = req.app.locals.mongoDB;
  const blockID = req.params.blockID;
  const authData = {id:blockID,type:"block",needsRole:ADMIN};
  hasAccessToFarm(authData, req.farms, mongoDB)
    .then((hasAccess) => {
      if (hasAccess){
        return deleteBlock(blockID, mongoDB)
      } else {
        res.status(403).json({
          err: `User doesn't have access to block with id: ${blockID}`
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
        error: `Unable to delete the block with ID: ${blockID}`
      });
    });
});
