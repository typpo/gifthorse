var mongo = require('mongodb')
  , mutil = require('../util/mongo.js')
  , rutil = require('../util/redis.js')
  , _ = require('underscore')

var redis = rutil.getConnection();
redis.on('end', function() {
  (_.throttle(function() {
    redis = rutil.getConnection();
  }, 10000))();  // don't reconnect more than once every 10s
});

redis.on('error', function(err) {
  console.log('redis err', err);

});

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
  if (redis) {
    var r = redis.get(key, function(err, reply) {
      if (err || !reply) {
        cb(false, null);
        return;
      }
      cb(err, JSON.parse(reply));
    });
  }
  else {
    cb(true, null);
  }
}

function genericSave(key, result) {
  if (redis) {
    // TODO setex
    redis.set(key, JSON.stringify(result));
  }
}

module.exports = {
  getItemLookup: getItemLookup,
  saveItemLookup: saveItemLookup,
  getBNLookup: getBNLookup,
  saveBNLookup: saveBNLookup,
}
