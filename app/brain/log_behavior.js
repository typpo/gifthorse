//
// Save stuff for later analysis.
//
// We log a couple things:
// - The queries that people run
// - The results that people get
// - THe clicks that people perform on these results
//

var mongo = require('mongodb')
  , mutil = require('../util/mongo.js')
  , rutil = require('../util/redis.js')

var QUERY_COLLECTION = 'queries';
var ITEM_COLLECTION = 'items';

var CLICK_THROUGH_ATTR = 'clickthrough',
    CLICK_HIDE_ATTR = 'clickhide',
    CLICK_ALREADYHAVE_ATTR = 'clickalreadyhave';

// Takes a list of queries
// cb(err, queryId)
function recordQueries(sessionid, queries, cb) {
  mutil.getCollection(QUERY_COLLECTION, function(err, collection) {
    if (err) {
      cb(true);
      return;
    }

    collection.insert({queries: queries, sid: sessionid}, function(err, docs) {
      if (!err && docs.length > 0)
        cb(null, docs[0]._id);
      else
        cb(true);
    });

  });
}

function recordResults(qid, results, cb) {
  mutil.getCollection(QUERY_COLLECTION, function(err, collection) {
    if (err) {
      cb(true);
      return;
    }

    collection.update({_id: new mongo.ObjectID(qid)}, {results:results},
      function(err) {
        cb(err);
    });

  });

}

function recordClickThrough(qid, rid, asin, cb) {
  return recordGenericClick(qid, rid, CLICK_THROUGH_ATTR, asin, cb);
}
function recordClickHide(qid, rid, asin, cb) {
  return recordGenericClick(qid, rid, CLICK_HIDE_ATTR, asin, cb);
}
function recordClickAlreadyHave(qid, rid, asin, cb) {
  return recordGenericClick(qid, rid, CLICK_ALREADYHAVE_ATTR, asin, cb);
}

function recordGenericClick(qid, rid, attr, asin, cb) {
  _recordClickForQuery(qid, rid, attr, function() {});
  _recordClickForItem(asin, attr, function() {});
}

function _recordClickForQuery(qid, rid, attr, cb) {
  mutil.getCollection(QUERY_COLLECTION, function(err, collection) {
    if (err) {
      cb(true);
      return;
    }

    collection.findOne({_id: new mongo.ObjectID(qid)},
      function(err, obj) {
        if (err || obj.results.length < rid + 1) {
          cb(true);
          return;
        }
        // update query
        obj.results[rid][attr] = true;
        collection.update({_id: new mongo.ObjectID(qid)}, {results:obj.results},
          function(err) {
            cb(err);
        });
    });
  });
}

function _recordClickForItem(asin, attr, cb) {
  var redis = redis.getConnection();
  redis.incr('clicks:' + asin + ':' + attr);
}


module.exports = {
  recordQueries: recordQueries,
  recordResults: recordResults,
  recordClickThrough: recordClickThrough,

}
