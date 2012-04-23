//
// Save stuff for later analysis.
//
// TODO log when someone 'already has this' - strong signal to serve that for
// future searches of the same query
//
// We log a couple things:
// - The queries that people run
// - The results that people get
// - THe clicks that people perform on these results
//

var mongo = require('mongodb')
  , mutil = require('../util/mongo.js')

var COLL_NAME = 'queries';

// Takes a list of queries
// cb(err, queryId)
function recordQueries(sessionid, queries, cb) {
  mutil.getCollection(COLL_NAME, function(err, collection) {
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
  mutil.getCollection(COLL_NAME, function(err, collection) {
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

function recordClickThrough(qid, rid, cb) {
  return recordGenericClick(qid, rid, 'clickthrough', cb);
}
function recordClickHide(qid, rid, cb) {
  return recordGenericClick(qid, rid, 'clickhide', cb);
}
function recordClickAlreadyHave(qid, rid, cb) {
  return recordGenericClick(qid, rid, 'clickalreadyhave', cb);
}

function recordGenericClick(qid, rid, attr, cb) {
  mutil.getCollection(COLL_NAME, function(err, collection) {
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
        obj.results[rid][attr] = true;
        collection.update({_id: new mongo.ObjectID(qid)}, {results:obj.results},
          function(err) {
            cb(err);
        });
    });
  });
}


module.exports = {
  recordQueries: recordQueries,
  recordResults: recordResults,
  recordClickThrough: recordClickThrough,

}
