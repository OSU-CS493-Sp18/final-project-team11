exports.generateAuthToken = generateAuthToken;
exports.requireAuthentication = requireAuthentication;

const jwt = require('jsonwebtoken');
const secretKey = process.env.SECRET_KEY;




function generateAuthToken(username, userID, privileges) {
  return new Promise((resolve, reject) => {
    const payload = { sub: username, id: userID, privileges: privileges};
    jwt.sign(payload, secretKey, { expiresIn: '24h' }, function (err, token) {
      if (err) {
        reject(err);
      } else {
        resolve(token);
      }
    });
  });
}

function requireAuthentication (needsRole) {
  return function(req, res, next) {
    const authHeader = req.get('Authorization') || '';
    const authHeaderParts = authHeader.split(' ');
    const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null;
    jwt.verify(token, secretKey, function (err, payload) {
      /* if error or client doesn't have the needed privileges, if privileges required */
      if (err || (needsRole && payload.privileges.indexOf(needsRole) === -1) ) {
        res.status(401).json({
          error: "Invalid authentication token"
        });
      } else {
        req.username = payload.sub;
        req.userID = payload.id;
        req.privileges = payload.privileges;
        next();
      }
    });
  }
}
