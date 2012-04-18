//
// Save stuff for later analysis.
//
// TODO log when someone 'already has this' - strong signal to serve that for
// future searches of the same query
//

var mongo = require('mongodb')
  , mutil = require('../util/mongo.js')

var COLL_NAME = 'queries';

// Takes a list of queries
// cb(err, queryId)
function recordQueries(queries, cb) {
  mutil.getCollection(COLL_NAME, function(err, collection) {
    if (err) {
      cb(true);
      return;
    }

    collection.insert({queries: queries}, function(err, docs) {
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

function recordClick(qid, rid, cb) {
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

        obj.results[rid].clicked = true;
        // TODO record click in some other places too, probably

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
  recordClick: recordClick,

}
