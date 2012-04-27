var mongo = require('mongodb')
  , mutil = require('../util/mongo.js')
  , rutil = require('../util/redis.js')

function getItemLookup(asin, cb) {
  genericLookup('gifthorse:items:' + asin, cb);
}

function saveItemLookup(asin, result) {
  genericSave('gifthorse:items:' + asin, result);
}

function getBNLookup(bnkey, cb) {
  genericLookup('gifthorse:bn:' + bnkey, cb);
}

function saveBNLookup(bnkey, result) {
  genericSave('gifthorse:bn:' + bnkey, result);
}

function genericLookup(key, cb) {
  var redis = rutil.getConnection();
  if (redis) {
    var r = redis.get(key, function(err, reply) {
      if (err || !reply) {
        cb(false, null);
        return;
      }
      cb(err, JSON.parse(reply));
      redis.end();
    });
  }
}

function genericSave(key, result) {
  var redis = rutil.getConnection();
  if (redis) {
    // TODO setex
    redis.set(key, JSON.stringify(result));
    redis.end();
  }
}

module.exports = {
  getItemLookup: getItemLookup,
  saveItemLookup: saveItemLookup,
  getBNLookup: getBNLookup,
  saveBNLookup: saveBNLookup,
}
