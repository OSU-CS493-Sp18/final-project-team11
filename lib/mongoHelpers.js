const ObjectId = require('mongodb').ObjectId;

module.exports = {

  /*
  * Used to get an ObjectId object of blockID.
  * This is needed to query by _id. The "else"
  *  will cause the query to result in 404
  */
  generateMongoIDQuery: function(id) {
    if (ObjectId.isValid(id)) {
      return { _id: new ObjectId(id) };
    } else {
      return { id: id };
    }
  },
};
