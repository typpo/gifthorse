var mongo = require('mongodb')
  , mutil = require('../util/mongo.js')
  , rutil = require('../util/redis.js')


function getItemLookup(asin) {
  var redis = rutil.getConnection();
  if (redis)
    return redis.get('gifthorse:items:' + asin);
  return null;
}

function saveItemLookup(asin, result) {
  var redis = rutil.getConnection();
  if (redis)
    redis.set('gifthorse:items:' + asin, result);
}

module.exports = {
  getItemLookup: getItemLookup,
  saveItemLookup: saveItemLookup,
}
