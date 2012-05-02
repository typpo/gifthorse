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
  console.log('Sess', sessionid, 'queried:', queries);

  mutil.getCollection(QUERY_COLLECTION, function(err, collection) {
    if (err) {
      cb(true);
      return;
    }

    collection.insert({queries: queries, sid: sessionid}, function(err, docs) {
      if (!err && docs.length > 0) {
        console.log('Recorded queries successfully');
        cb(null, docs[0]._id);
      }
      else {
        cb(true);
      }
    });

  });
}

function recordResults(qid, results, cb) {
  console.log('Recording results for', qid);
  mutil.getCollection(QUERY_COLLECTION, function(err, collection) {
    if (err) {
      cb(true);
      return;
    }

    collection.findAndModify(
      {_id: new mongo.ObjectID(qid+'')},
      [['_id','asc']],
      {$set: {results:results}},
      {safe: true},
      function(err) {
        if (!err) console.log('Recorded results successfully');
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
  console.log('Recording click for query', qid,rid,attr);
  mutil.getCollection(QUERY_COLLECTION, function(err, collection) {
    if (err) {
      cb(true);
      return;
    }

    collection.findOne({_id: new mongo.ObjectID(qid)},
      function(err, obj) {
        if (err || !obj || obj.results.length < rid + 1 || !obj.results[rid]) {
          cb(true);
          return;
        }
        // update query
        obj.results[rid][attr] = true;
        collection.findAndModify(
          {_id: new mongo.ObjectID(qid+'')},
          [['_id','asc']],
          {$set: {results:obj.results}},
          {safe: true},
          function(err) {
            if (!err) console.log('Recorded click successfully');
            cb(err);
        });
    });
  });
}

function _recordClickForItem(asin, attr, cb) {
  var redis = rutil.getConnection();
  if (redis) {
    try {
      redis.incr('gifthorse:clicks:' + asin + ':' + attr);
    }
    catch (e) {
      console.log('redis connection failed');
    }
  }
}


module.exports = {
  recordQueries: recordQueries,
  recordResults: recordResults,
  recordClickThrough: recordClickThrough,
  recordGenericClick: recordGenericClick,

}
