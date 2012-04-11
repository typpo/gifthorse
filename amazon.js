var  _ = require('underscore') , freebase = require('freebase')
  , winston = require('winston')
  , record = require('./record.js')
  , config = require('./config.js')
  , amazon_util = require('./amazon_util.js')
  , stemmer = require('porter-stemmer').stemmer

var OperationHelper = require('apac').OperationHelper;
var opHelper = new OperationHelper({
  awsId:     config.amazon.key,
  awsSecret: config.amazon.secret,
  assocId:   config.amazon.associate,
});

var EXCLUDE_BINDINGS = ['Amazon Instant Video', 'Kindle Edition',
    'MP3 Download', 'Personal Computers', ];

var EXCLUDE_NODES = ['Just Arrived', 'Just arrived', 'All product'];

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

  runSearch(keyword, cb);

  // stem and disambiguate
  /*
  winston.info('Stemming ' + keyword);
  keyword = stemmer(keyword);

  winston.info('Freebase search for ' + keyword);
  freebase.search(keyword, function(freebase_results) {
    winston.info('freebase results', freebase_results);

    if (freebase_results.length > 0) {
      if (freebase_results.length > 1
        && freebase_results[0].search.score
          - freebase_results[1].search.score < 2.0) {
        // don't coerce; too close
        // remember this so we can improve later
        record.ambiguous_query(keyword);
      }
      else {
        winston.info('Coercing ' + keyword + ' to ' + freebase_results[0].name);
        // put in list for classifer training later
        record.coercion(keyword, freebase_results[0].name);
        keyword = freebase_results[0].name;
      }
    }

    runSearch(keyword);

  });
  */
}

// cb(err, result)
// This callback will be called multiple times
function runSearch(keyword, cb) {
  winston.info('Searching...', keyword);

  opHelper.execute('ItemSearch', {
    'SearchIndex': 'All',
    'Keywords': keyword,
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
        return true;//(bindings_count[a] >= 2)
      })
      .sort(function(a, b) {
        return bindings_count[b] - bindings_count[a];
      })
      .slice(0, 2);

    winston.info('categories count: ', bindings_count);
    winston.info('qualifying top categories: ', categories)

    getTopGiftsForCategories(categories, bindings_map, cb);
  });
}

function getTopGiftsForCategories(categories, bindings_map, cb) {
  // Grab the amazon browse nodes for these categories (bindings)
  var node_counts = {};
  var top_gifted_items = {};  // map from browse node name to items
  var request_queue = [];

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
      if (bn.Name in seen ||
          EXCLUDE_NODES.indexOf(bn.Name) > -1) {
        return false;
      }

      request_queue.push(function() {
        getTopGiftedForNode(bn, function(err, result) {
          if (!err && result) {
            top_gifted_items[bn.Name] = (result);
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
  _.map(request_queue, function(fn) {
    fn();
  });

  // Collect responses
  var completed = 0;
  function requestComplete() {
    completed++;
    if (completed == request_queue.length) {
      // Nodes contains the browse nodes for all the items that were
      // in the top categories
      console.log('top category browse nodes breakdown: ', node_counts);
      console.log(top_gifted_items);
      var final_results = [];
      var keys = _.keys(top_gifted_items).sort(function(a, b) {
        // TODO tiebreak by how deep the nodes are
        return node_counts[b] - node_counts[a];
      });
      _.each(keys, function(key) {
        final_results.push(top_gifted_items[key]);
      });

      final_results = _.unique(final_results, false, function(item) {
        return item.ASIN;
      });
      if (final_results.length > 0) {
        cb(null, final_results);
      }
      else
        cb(null, null);
    }
  }
}

function getTopGiftedForNode(bn, cb) {
  walkTree(bn.BrowseNodeId, function(err, ancestorCount) {
    if (err) {
      cb(err, null);
      return;
    }

    // We omit overly general browse nodes...must be at least 4 deep in hierarchy
    if (ancestorCount > 3) {
      gifted(bn, function(err, item) {
        if (err) {
          cb(err, null);
          return;
        }
        cb(null, item);
      });
    }
    else {
      //console.log('omitting', bn.Name);
      cb(null, null);
    }
  });
} // end addNode

// Walks the ancestor/child tree of a BrowseNode
// callback(err, ancestorCount)
function walkTree(bid, cb) {
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/FindingBrowseNodes.html

  //winston.info('Retrieving parent browse node for ' + bid + '...');

  opHelper.execute('BrowseNodeLookup', {
    'BrowseNodeId': bid,
  }, function(error, results) {

    if (error) {
      winston.error('Error: ' + error + "\n");
      cb(true, null);
      return;
    }

    var bn = results.BrowseNodes.BrowseNode;
    if (!bn) {
      cb(new Error('no browse node'), null);
      return;
    }

    var ancestor = bn.Ancestors && bn.Ancestors.BrowseNode;
    var ancestorCount = 0;
    while (ancestor) {
      if (!ancestor.Name) {
        // end of the line
        break;
      }
      ancestorCount++;
      ancestor = ancestor.Ancestors && ancestor.Ancestors.BrowseNode;
    }

    //console.log('***', bn.Name);

    cb(null, ancestorCount);

    // TODO children don't quite work the same - can have multiple children
    /*
    var child = bn.Children && bn.Children.BrowseNode;
    while (child) {
      if (!child.Name) {
        break;
      }
      console.log(child.Name, '->');
      child = child.Children && child.Children.BrowseNode;
    }
    */

    /*

    var children = bn.Children;

    console.log(bn.Name, '-->');
    console.log(ancestor.BrowseNode);
    console.log(ancestor.BrowseNode.Ancestors.BrowseNode.Ancestors);
    //console.log(children);

    */
  });

}

function top(bn, cb) {
  // Gets top items for a browse node
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/TopSellers.html
  winston.log('Top items...');
  bnLookup(bn, "TopSellers", cb);
}

function wishedfor(bn, cb) {
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/BrowseNodeLookup.html
  // BrowseNodeLookup ResponseGroup can be MostGifted | NewReleases | MostWishedFor | TopSellers

  bnLookup(bn, "MostWishedFor", cb);

}

function gifted(bn, cb) {
  // TODO incorporate other responsegroups, such as MostWishedFor
  bnLookup(bn, "MostGifted", function(err, results) {
    if (err) {
      cb(err, null);
      return;
    }
    cb(null, results.BrowseNodes.BrowseNode.TopItemSet.TopItem[0]);
  });
}

function similar() {
  // Motivating customers to buy
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/SuggestingSimilarItemstoBuy.html
}

function reviews() {
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/CHAP_MotivatingCustomerstoBuy.html#GettingCustomerReviews

}

function bnLookup(bn, responsegroup, cb) {
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

module.exports = {
  search: search,
}
