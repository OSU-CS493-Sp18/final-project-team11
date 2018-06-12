/*
* Schema describing new user format
*/
const newUserSchema =
  {
    "title": "New User Schema",
    "type": "object",
    "properties": {
      "username": {
        "description": "the username the user wants",
        "type": "string",
        "maxLength": 128
      },
      "name": {
        "description": "the name of the user",
        "type": "string",
        "maxLength": 128
      },
      "email": { "type": "string", "format": "email" },
      "phone": { "type": "string", "pattern": "^[0-9()\\-\\.\\s]+$" },
      "password": { "type": "string", "maxLength": 128}
    },
    "required": ["username", "name", "email", "phone", "password"],
    "additionalProperties": true
  };
/*
* Schema describing the format of a user login.
*/
const loginUserSchema =
  {
    "title": "Login User Schema",
    "type": "object",
    "properties": {
      "username": { "type": "string", "maxLength": 128 },
      "password": { "type": "string", "maxLength": 128 }
    },
    "required": ["username", "password"],
    "additionalProperties": false
  };
/*
 * Schema describing farm format
 */
const farmsSchema =
{
  "title": "Farm Schema",
  "type": "object",
  "properties": {
    "name": {
      "description": "the name of the farm",
      "type": "string",
      "maxLength": 128
    },
    "address": {
      "type": "object",
      "additionalProperties": { "type": "string" },
      "maxProperties": 6,
      "required": ["street", "zipcode", "city", "country"]
    },
    "authUsers": {
      "type": "array",
      "minItems": 1,
      "items": {
        "title": "User Authorization",
        "description": "List of objects specifying the username and that user's privilege",
        "type": "object",
        "properties": {
          "username": { "type": "string", "maxLength": 128 },
          "privilege": {"type": "integer", "minimum": 1, "maximum": 3}
        },
        "required": ["username", "privilege"],
        "additionalProperties": false
      }
    },
  },
  "required": ["name", "address", "authUsers"],
  "additionalProperties": false
};
/*
* Schema describing block format
*/
const blocksSchema =
{
  "title": "Block Schema",
  "type": "object",
  "properties": {
    "farmID": {
      "description": "the ID of the farm the block is in",
      "type": "string"
    },
    "name": {
      "description": "the name of the block",
      "type": "string",
      "maxLength": 50
    },
    "location": {
      "description": "general location of the block",
      "type": "string",
      "maxLength": 250
    }
  },
  "required": ["farmID", "name", "location"],
  "additionalProperties": false
};
/*
* Schema describing sensor format
*/
const sensorsSchema =
{
  "title": "Sensor Schema",
  "type": "object",
  "properties": {
    "blockID": {
      "description": "the ID of the block the sensor is in",
      "type": "string"
    },
    "type": {
      "description": "the type of sensor this is",
      "type": "string",
      "maxLength": 50
    },
    "location": {
      "type": "string",
      "description": "general location of the block",
      "maxLength": 128
    }
  },
  "required": ["blockID", "type", "location"],
  "additionalProperties": false
};
/*
 * Schema describing temper reading inserts.
 */
  const temperaturesSchema =
    {
      "title": "Temperature Reading Schema",
      "type": "object",
      "properties": {
        "sensorID": { "type": "string"},
        "magnitude": { "type": "number"},
        "units": {
          "type": "string",
          "oneOf": [
            { "pattern": "fahrenheit" },
            { "pattern": "celsius" }
          ]
        }
      },
      "required": ["sensorID", "magnitude", "units"],
      "additionalProperties": true
  };
/*
 * Schema describing temper reading inserts.
 */
  const soilsSchema =
    {
      "title": "Soil Reading Schema",
      "type": "object",
      "properties": {
        "sensorID": { "type": "string"},
        "eConductivity": {
          "type": "object",
          "properties": {
            "magnitude": { "type": "number"},
            "units": {
              "type": "string"
            }
          },
          "required": ["magnitude", "units"]
        },
        "volumetricWater": {
          "type": "object",
          "properties": {
            "magnitude": { "type": "number"},
            "units": {
              "type": "string"
            }
          },
          "required": ["magnitude", "units"]
        },
        "soilTemp": {
          "type": "object",
          "properties": {
            "magnitude": { "type": "number"},
            "units": {
              "type": "string",
              "oneOf": [
                { "pattern": "fahrenheit" },
                { "pattern": "celsius" }
              ]
            }
          },
          "required": ["magnitude", "units"]
        }

      },
      "required": ["sensorID"],
      "additionalProperties": true
  };
/*
* Schema describing temper reading inserts.
*/
 const irrigationsSchema =
   {
     "title": "Soil Reading Schema",
     "type": "object",
     "properties": {
       "sensorID": { "type": "string"},
       "timeTurnedOn": { "type": "string", "format": "date-time" },
       "timeTurnedOff": { "type": "string", "format": "date-time" }
     },
     "required": ["sensorID", "timeTurnedOn", "timeTurnedOff"],
     "additionalProperties": true
 };



exports.farmsSchema = farmsSchema;
exports.blocksSchema = blocksSchema;
exports.sensorsSchema = sensorsSchema;
exports.newUserSchema = newUserSchema;
exports.loginUserSchema = loginUserSchema;
exports.temperaturesSchema = temperaturesSchema;
exports.soilsSchema = soilsSchema;
exports.irrigationsSchema = irrigationsSchema;
