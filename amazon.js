var  _ = require('underscore')
  , freebase = require('freebase')
  , winston = require('winston')
  , stemmer = require('porter-stemmer').stemmer
  , record = require('./record.js')
  , config = require('./config.js')
  , redis = require('./redis.js')
  , amazon_static = require('./static.js')
  , scoring= require('./scoring.js')
  , hierarchy = require('./hierarchy.js')

var OperationHelper = require('apac').OperationHelper;
var opHelper = new OperationHelper({
  awsId:     config.amazon.key,
  awsSecret: config.amazon.secret,
  assocId:   config.amazon.associate,
});

var EXCLUDE_BINDINGS = ['Amazon Instant Video', /*'Kindle Edition',*/
    'MP3 Download', 'Personal Computers', ];

var EXCLUDE_NODES = ['Just Arrived', 'Just arrived', 'All product', 'Deep discounts'];

var EXCLUDE_PRODUCT_GROUPS = ['Mobile Application', 'eBooks'];

var MAP_BINDINGS = {
  'Blu-ray': 'Video',
  'DVD': 'Video',
}

function search(keyword, /*opts, */cb) {
  // Search Amazon for a keyword
  // TODO options:
  //  maxprice
  //  minprice
  //
  //sorting http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/SortingbyPopularityPriceorCondition.html
  //search http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/CommonItemSearchParameters.html


  // TODO map common queries with extraneous words

  runSearch(keyword, cb);
}

// cb(err, result)
// This callback will be called multiple times
function runSearch(query, cb) {
  winston.info('Searching...', query);

  opHelper.execute('ItemSearch', {
    'SearchIndex': 'All',
    'Keywords': query,
    'ResponseGroup': 'ItemAttributes,Offers,BrowseNodes',
    'Availability': 'Available',
    //'MinimumPrice': 333.50,
    //'Sort': 'salesrank',
    //'BrowseNode'
  }, function(err, results) {
    if (err) {
      winston.info('Error: ' + err + "\n")
      cb(err, null);
      return;
    }
    if (results.Items.Request.IsValid == 'False') {
      winston.info(results.Items.Request.Errors);
      cb(err, null);
      return;
    }

    var bindings_count = {};
    var bindings_map = {};

    console.log(results.Items);

    // Grab item bindings (categories) from general search results
    _.map(results.Items.Item, function(item) {
      //winston.info(item);

      var binding = item.ItemAttributes.Binding;
      binding = MAP_BINDINGS[binding] || binding;
      if (!binding || EXCLUDE_BINDINGS.indexOf(binding) > -1) {
        return;
      }
      if (!bindings_count[binding]) {
        bindings_count[binding] = 0;
        bindings_map[binding] = [];
      }
      bindings_count[binding]++;
      bindings_map[binding].push(item);
    });

    // Choose the most interesting/popular categories
    // TODO instead of a threshold of 2, make it so that the threshold is
    // half as much as the next popular category
    categories = _.keys(bindings_count)
      .filter(function(a) {
        return (bindings_count[a] >= 2)
      })
      .sort(function(a, b) {
        return bindings_count[b] - bindings_count[a];
      })
      //.slice(0, 2);

    winston.info('categories count: ', bindings_count);
    winston.info('qualifying top categories: ', categories)

      // TODO handle when categories is empty :(
      // eg. for "romance"

    getTopGiftsForCategories(categories, bindings_map, query, cb);
  });
}

function getTopGiftsForCategories(categories, bindings_map, query, cb) {
  // Grab the amazon browse nodes for these categories (bindings)
  var node_counts = {};
  var top_gifted_items = {};  // map from browse node name to items
  var top_gifted_item_depths = {};  // map from browse node name to their depth in amazon browse node hierarchy
  var pending_request_fns = [];

  // Loop through all of the top categories for this search result
  _.map(categories, function(cat) {
    winston.info('lookup category ' + cat);
    var items = bindings_map[cat];
    var seen = {};

    function checkNode(bn) {
      var name = bn.Name;
      if (!node_counts[name])
        node_counts[name] = 0;
      node_counts[name]++;

      // Don't query duplicate nodes
      if (seen[name] ||
          EXCLUDE_NODES.indexOf(bn.Name) > -1) {
        return false;
      }

      pending_request_fns.push(function() {
        getTopSuggestionsForNode(bn, query, function(err, results, depth) {
          if (!err && results && results.length > 0) {
            top_gifted_items[bn.Name] = results;
            top_gifted_item_depths[bn.Name] = depth;
          }
          requestComplete();
        });
      });
      seen[name] = true;
    } // end checkNode

    // Get all the items in this category and look up their browse node
    _.map(items, function(item) {
      if (!item.BrowseNodes)
        return;

      var browsenode = item.BrowseNodes.BrowseNode;

      if (_.isArray(browsenode)) {
        _.map(browsenode, checkNode);
      }
      else {
        checkNode(browsenode);
      }
    }); // end items loop
  }); // end categories loop


  // Fire request queue
  _.map(pending_request_fns, function(fn) {
    fn();
  });

  // Collect responses and create scores
  var completed = 0;
  function requestComplete() {
    completed++;
    if (completed == pending_request_fns.length) {
      console.log('top category browse nodes breakdown: ', node_counts);
      console.log(top_gifted_items);

      var final_item_list = [];
      _.each(top_gifted_items, function(bn_items, bn_key) {
        _.each(bn_items, function(bn_item) {
          var result = {
            // compute a base score
            score: 1.0 * top_gifted_item_depths[bn_key] * scoring.DEPTH_WEIGHT
              * node_counts[bn_key] * scoring.NODE_COUNT_WEIGHT,
            item: bn_item,
          };
          scoring.adjustResultScore(result);
          final_item_list.push(result);
        });
      });

      // TODO still need to get rid of duplicates
      // and probably give them a boost with scoring.CROSS_BROWSENODE_WEIGHT

      if (final_item_list.length > 0) {
        cb(null, final_item_list);
      }
      else
        cb(null, null);
    }
  }
}

// callback(err, item, depth)
function getTopSuggestionsForNode(bn, query, cb) {
  console.log('getting the top suggestions for', bn.Name);
  var node = hierarchy.getTreeNodeById(bn.BrowseNodeId);
  if (!node) {
    cb(new Error("Couldn't find browse node " + bn.BrowseNodeId), null, null);
    return;
  }

  // We omit overly general browse nodes...must be at least 4 deep in hierarchy
  // TODO make this variable, based on average ancestor depth
  // always allow when browse node name matches query name, eg. for 'Shopping'
  if (node.depth > 2 || query.toLowerCase() == bn.Name.toLowerCase()) {
    giftSuggestions(bn, function(err, items) {
      if (err) {
        cb(err, null, node.depth);
        return;
      }
      cb(null, items, node.depth);
    });
  }
  else {
    console.log('omitting', bn.Name);
    cb(null, null, null);
  }
} // end addNode

function giftSuggestions(bn, cb) {
  bnLookup(bn, "MostGifted,MostWishedFor,TopSellers", function(err, results) {
    if (err) {
      cb(err, null);
      return;
    }
    if (results.BrowseNodes.BrowseNode.TopItemSet.length < 1) {
      cb("Empty TopItemSet result for " + bn.Name, null);
      return;
    }

    topitem_map = {};
    _.each(results.BrowseNodes.BrowseNode.TopItemSet, function(item_set) {
      if (!item_set || !item_set.TopItem || !item_set.TopItem.length > 0) {
        return true;
      }

      // Top item of this list type
      var best_item = item_set.TopItem[0];
      if (EXCLUDE_PRODUCT_GROUPS.indexOf(best_item.ProductGroup) > -1) {
        return true;
      }
      if (topitem_map[best_item.ASIN]) {
        topitem_map[best_item.ASIN].type.push(item_set.Type);
      }
      else {
        best_item.type = [item_set.Type];
        topitem_map[best_item.ASIN] = best_item;
      }
    });
    cb(null, _.values(topitem_map));
  });
}

function similar() {
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/SuggestingSimilarItemstoBuy.html
}

function reviews() {
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/CHAP_MotivatingCustomerstoBuy.html#GettingCustomerReviews

}

function bnLookup(bn, responsegroup, cb) {
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/BrowseNodeLookup.html
  // TODO cache this
  opHelper.execute('BrowseNodeLookup', {
    'ResponseGroup': responsegroup,
    'BrowseNodeId': bn.BrowseNodeId,
    }, function(error, results) {
      if (error) {
        winston.error('Error: ' + error + "\n")
        cb(error, null);
        return;
      }
      console.log('bnLookup', responsegroup, bn.Name, '-->');
      cb(null, results);

  });
}

function distanceBetweenNodeNames(n1, n2) {
  return hierarchy.distanceBetweenNodeNames(n1, n2);
}

function browseNodeExists(nodename) {
  return hierarchy.browseNodeExists(stemmer(nodename));
}

function fuzzyBrowseNodeMatch(nodename) {
  return hierarchy.fuzzyBrowseNodeMatch(nodename);
}


module.exports = {
  search: search,
}
