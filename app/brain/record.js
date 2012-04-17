//
// Save stuff for later analysis.
//

var mongo = require('mongodb')
  , mutil = require('../util/mongo.js')

var COLL_NAME = 'queries';

// Takes a list of queries
function recordQueries(queries, cb) {
  mutil.getCollection(COLL_NAME, function(err, collection) {
    if (err) {
      cb(true);
      return;
    }

  });
}

function recordResults(qid, results, cb) {
  mutil.getCollection(COLL_NAME, function(err, collection) {
    if (err) {
      cb(true);
      return;
    }

  });

}

function recordClick(qid, rid, cb) {
  mutil.getCollection(COLL_NAME, function(err, collection) {
    if (err) {
      cb(true);
      return;
    }

  });
}

module.exports = {
  recordQueries: recordQueries,
  recordResults: recordResults,
  recordClick: recordClick,

}
