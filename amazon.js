var  _ = require('underscore')
  , freebase = require('freebase')
  , winston = require('winston')
  , stemmer = require('porter-stemmer').stemmer
  , record = require('./record.js')
  , config = require('./config.js')
  , amazon_static = require('./static.js')
  , scoring= require('./scoring.js')

var OperationHelper = require('apac').OperationHelper;
var opHelper = new OperationHelper({
  awsId:     config.amazon.key,
  awsSecret: config.amazon.secret,
  assocId:   config.amazon.associate,
});

var EXCLUDE_BINDINGS = ['Amazon Instant Video', 'Kindle Edition',
    'MP3 Download', 'Personal Computers', ];

var EXCLUDE_NODES = ['Just Arrived', 'Just arrived', 'All product', 'Deep discounts'];

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

    getTopGiftsForCategories(categories, bindings_map, query, cb);
  });
}

function getTopGiftsForCategories(categories, bindings_map, query, cb) {
  // Grab the amazon browse nodes for these categories (bindings)
  var node_counts = {};
  var top_gifted_items = {};  // map from browse node name to items
  var top_gifted_item_depths = {};  // map from browse node name to their depth in amazon browse node hierarchy
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
  _.map(request_queue, function(fn) {
    fn();
  });

  // Collect responses and create scores
  var completed = 0;
  function requestComplete() {
    completed++;
    if (completed == request_queue.length) {
      console.log('top category browse nodes breakdown: ', node_counts);
      console.log(top_gifted_items);

      // not the most efficient way of doing this..
      var scores_list =  _.values(node_counts);
      var min_score = _.min(scores_list);
      var max_score = _.max(scores_list);

      var final_results = [];
      var browsenodes = _.keys(top_gifted_items);
      _.each(browsenodes, function(node_name) {
        // Everything is put into buckets by browsenode
        top_gifted_items[node_name].sort(function(a, b) {
          return a.ASIN < b.ASIN ? -1 : a.ASIN > b.ASIN ? 1 : 0;
        });
        console.log(top_gifted_items[node_name]);
        top_gifted_items[node_name] = _.unique(
          // TODO add more weight if there were duplicates. MostGifted and MostWishedFor should be merged.
          top_gifted_items[node_name], true, function(a) {
            return a.ASIN;
        });

      });
      browsenodes.sort(function(keya,keyb) {
        var a = top_gifted_items[keya][0];
        var b = top_gifted_items[keyb][0];
        return a.ASIN < b.ASIN ? -1 : a.ASIN > b.ASIN ? 1 : 0;
      });
      for (var i=0; i < browsenodes.length; i++) {
        var key = browsenodes[i];

        // this is a base score
        // initially, scores are out of 50
        var score = ((node_counts[key]) / (max_score))*100;

        var browsenode_results = [];  // results for this browse node

        // Detect duplicate
        if (i < browsenodes.length - 1
            && top_gifted_items[browsenodes[i]][0].ASIN === top_gifted_items[browsenodes[i+1]][0].ASIN) {
          // adjust score if the item showed up multiple times in our results
          // TODO we assume that duplicates have the same depth in amazon hierarchy.. This is not always
          // the case because browse nodes can appear in multiple places in the hierarchy
          score *= scoring.DUPLICATE_WEIGHT;
          _.each(top_gifted_items[key], function(item) {
            browsenode_results.push({
              score: score,
              item: item,
            });
          });
          i++;
        }
        else {
          _.each(top_gifted_items[key], function(item) {
            browsenode_results.push({
              score: score,
              item: item,
            });
          });
        }

        // Final adjustments for each item in this browsenode category
        _.each(browsenode_results, function(result) {
          // Penalize long boring items
          if (result.item.Title.length > scoring.LENGTH_WEIGHT_THRESHOLD) {
            result.score *= scoring.LENGTH_WEIGHT;
          }

          // Penalize books :(
          if (result.item.ProductGroup == 'Book') {
            result.score *= scoring.BOOK_WEIGHT;
          }

          if (result.item.type == 'MostWishedFor') {
            result.score *= scoring.WISHEDFOR_WEIGHT;
          }
          else if (result.item.type == 'MostGifted') {
            result.score *= scoring.GIFTED_WEIGHT;
          }

          result.score = Math.min(100, Math.floor(result.score*2.85));
        });
        final_results.push.apply(final_results, browsenode_results);
      }

      if (final_results.length > 0) {
        cb(null, final_results);
      }
      else
        cb(null, null);
    }
  }
}

// callback(err, item, depth)
function getTopSuggestionsForNode(bn, query, cb) {
  console.log('getting the top suggestions for', bn.Name);
  walkTree(bn.BrowseNodeId, function(err, ancestorCount) {
    if (err) {
      cb(err, null, null);
      return;
    }

    // We omit overly general browse nodes...must be at least 4 deep in hierarchy
    // TODO make this variable, based on average ancestor depth
    // always allow when browse node name matches query name, eg. for 'Shopping'
    if (ancestorCount > 3/* && ancestorCount < 5*/ || query.toLowerCase() == bn.Name.toLowerCase()) {
      giftSuggestions(bn, function(err, items) {
        if (err) {
          cb(err, null, ancestorCount);
          return;
        }
        cb(null, items, ancestorCount);
      });
    }
    else {
      console.log('omitting', bn.Name);
      cb(null, null, null);
    }
  });
} // end addNode

// Walks the ancestor/child tree of a BrowseNode
// callback(err, ancestorCount)
function walkTree(bid, cb) {
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/FindingBrowseNodes.html
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
  // BrowseNodeLookup ResponseGroup can be MostGifted | NewReleases | MostWishedFor | TopSellers
  bnLookup(bn, "MostWishedFor", cb);
}

function giftSuggestions(bn, cb) {
  // TODO handle multiple responsegroups, such as MostWishedFor,MostGifted,TopSellers
  bnLookup(bn, "MostGifted,MostWishedFor", function(err, results) {
    if (err) {
      cb(err, null);
      return;
    }
    if (results.BrowseNodes.BrowseNode.TopItemSet.length < 1) {
      cb("Empty TopItemSet result for " + bn.Name, null);
      return;
    }

    topitems = [];
    _.each(results.BrowseNodes.BrowseNode.TopItemSet, function(item_set) {
      if (!item_set || !item_set.TopItem || !item_set.TopItem.length > 0) {
        //cb("Empty TopItem result for " + bn.Name, null);
        return false;
      }
      // Top item of this list type
      var best_item = item_set.TopItem[0];
      best_item.type = item_set.Type;
      topitems.push(best_item);
    });
    cb(null, topitems);
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

module.exports = {
  search: search,
}
