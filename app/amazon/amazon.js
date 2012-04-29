var  _ = require('underscore')
  , freebase = require('freebase')
  , winston = require('winston')
  , stemmer = require('porter-stemmer').stemmer
  , log_behavior = require('../brain/log_behavior.js')
  , config = require('../config.js')
  , scoring = require('../scoring.js')
  , amazon_static = require('./static.js')
  , hierarchy = require('./hierarchy.js')
  , reviews = require('./reviews.js')
  , cache = require('./cache.js')

  , suggest = require('../brain/suggest.js')
  , log_behavior = require('../brain/log_behavior.js')

  , manual_browsenode_mapping = require('./manual_browsenode_mapping.js')

var OperationHelper = require('apac').OperationHelper;
var opHelper = new OperationHelper({
  awsId:     config.amazon.key,
  awsSecret: config.amazon.secret,
  assocId:   config.amazon.associate,
});

var BN_LOOKUP_QUERY_PARAMS = ['MostGifted','MostWishedFor','TopSellers'];
var BN_LOOKUP_QUERY_STRING = BN_LOOKUP_QUERY_PARAMS.join(',');

var EXCLUDE_BINDINGS = [/*'Amazon Instant Video',*/ /*'Kindle Edition',*/
    'MP3 Download', 'Personal Computers', ];

var EXCLUDE_NODES = ['Just Arrived', 'Just arrived', 'All product',
    'Deep discounts'];

var EXCLUDE_PRODUCT_GROUPS = ['Mobile Application', 'Magazine',
    'Automotive Parts and Accessories'];

var MAP_BINDINGS = {
  'Blu-ray': 'Video',
  'DVD': 'Video',
}

function search(queries, cb) {
  // TODO these should share qids

  var qs = queries.split(',');
  var compiled_qid;
  var compiled_results = [];

  var search_completed = _.after(qs.length + 1, function() {  // +1 for recordQueries
    if (compiled_results.length < 1) {
      cb(true, null);
      return;
    }

    var cb_results = [];
    var max_len = _.max(_.map(compiled_results, function(r) { return r.results.length; }));
    for (var i=0; i < max_len; i++) {
      for (var j=0; j < compiled_results.length; j++) {
        var list = compiled_results[j].results;
        if (list && list.length > i) {
          cb_results.push(list[i]);
        }
      }
    }

    var final_results = {
      qid: compiled_qid,
      results: cb_results,
    };
    cb(null, final_results);

    // Record these results
    log_behavior.recordResults(compiled_qid, final_results, function() {
    });
  });

  _.map(qs, function(q, idx) {
    searchKeyword(q, function(err, results) {
      if (!err)
        compiled_results[idx] = results;
      search_completed();
    });
  });


  // Recoed this query to get qid
  log_behavior.recordQueries('sessid', qs, function(err, qid) {
    compiled_qid = qid;
    search_completed();
  });
}

function searchKeyword(keyword, cb) {
  getTopGiftsForCategories(keyword, function(err, results) {
    cb(err, {
      results: results,
    });
  });
}

function getTopGiftsForCategories(query, cb) {
  // Grab the amazon browse nodes for these categories (bindings)
  var node_counts = {};
  var top_gifted_items = {};  // map from browse node name to items
  var top_gifted_item_depths = {};  // map from browse node name to their depth in amazon browse node hierarchy
  // Request queue that collects responses and scores
  var completed = 0;
  function requestComplete() {
    completed++;
    if (completed === pending_request_fns.length) {
      console.log('top category browse nodes breakdown: ', node_counts);
      //console.log(top_gifted_items);

      var result_list = [];
      _.map(top_gifted_items, function(bn_items, bn_key) {
        var tmp_result_list = [];
        _.map(bn_items, function(bn_item) {
          var result = {
            // compute a base score
            score: 1.0 /** top_gifted_item_depths[bn_key] * scoring.DEPTH_WEIGHT*/
              * node_counts[bn_key] * scoring.NODE_COUNT_WEIGHT,
            item: bn_item,
            bName: bn_key,
          };
          scoring.adjustResultScore(result, query);
          tmp_result_list.push(result);
        });

        // tmp_result_list contains ALL results for this browsenode.
        // We need to cut it down to prevent an obscene amount of similar
        // results.
        var truncated_result_list = tmp_result_list.sort(function(a, b) {
          return b.score - a.score;
        }).slice(0,2);

        result_list.push.apply(result_list, truncated_result_list);
      });

      // TODO also use CROSS_BROWSENODE_WEIGHT

      // We dedup by title, not ASIN (because things like paperback
      // vs hardcover have different ASINs)
      var title_counts = {};
      var title_to_result = {};
      _.map(result_list, function(result) {
        var title = result.item.Title;
        if (!title_counts[title]) {
          title_counts[title] = 0;
          title_to_result[title] = result;
        }
        title_counts[title]++;
      });

      var deduped_results = _.chain(title_to_result).map(function(result, title) {
        result.score *= scoring.DUPLICATE_WEIGHT * title_counts[title];
        return result;
      }).values().value();

      var count_final_result = _.after(deduped_results.length, function() {
        if (this_is_it.length > 0) {
          cb(null, this_is_it);
        }
        else {
          cb(null, null);
        }
      });

      var this_is_it = [];
      console.log('Gathering final itemlookup results..');
      _.map(deduped_results.slice(0, 20), function(result) {
        // look up item to get its image
        itemLookup(result.item.ASIN, function(err, itemlookup_result) {
          if (err || !itemlookup_result) {
            count_final_result();
            return;
          }
          var itemobj = itemlookup_result.Items.Item;
          if (!itemobj) {
            count_final_result();
            return;
          }
          else if (itemobj.LargeImage) {
            result.image = itemobj.LargeImage ? itemobj.LargeImage.URL : itemobj.MediumImage.URL;
          }
          else if (itemobj.ImageSets && itemobj.ImageSets.ImageSet) {
            var iset = itemobj.ImageSets.ImageSet;
            if(_.isArray(iset)) {
              // this is fucked up
              iset = iset[0];
            }

            if (iset.LargeImage)
              result.image = iset.LargeImage.URL
            else if (iset.MediumImage)
              result.image = iset.MediumImage.URL;
            else if (iset.SmallImage)
              result.image = iset.SmallImage.URL;
          }
          else {
            count_final_result();
            return;
          }

          this_is_it.push(result);
          count_final_result();
        });
      });

    }
  } // end requestComplete


  // Build request queue
  var pending_request_fns = [];

  // Add manual browsenode mappings for this search result
  var premapped_bns = manual_browsenode_mapping.lookupQuery(query);
  var keyword_treenodes = hierarchy.nodesForQuery(query);
  if (premapped_bns.length > 0) {
    console.log('Using premapped browsenodes');
    _.map(premapped_bns, function(bn) {
      if (!node_counts[bn.BrowseNodeId]) node_counts[bn.BrowseNodeId] = 0
      node_counts[bn.BrowseNodeId] += 8;    // artificially inflate node counts
      // TODO this code is duped below
      pending_request_fns.push(function() {
        topSuggestionsForNode(bn, query, true, function(err, results, depth) {
          if (!err && results && results.length > 0) {
            top_gifted_items[bn.BrowseNodeId] = results;
            top_gifted_item_depths[bn.BrowseNodeId] = depth;
          }
          requestComplete();
        });
      });
    });

    // Fire request queue
    _.map(pending_request_fns, function(fn) {fn();});
  }
  else if (keyword_treenodes && keyword_treenodes.length > 0) {
    console.log('Using keyword browsenodes');
    // TODO what happens if there's only one match?  Shoudl this be combined withi
    // the next case?
    keyword_treenodes = keyword_treenodes.sort(function(a, b) {
      // in the case of exact match, prefer broader browse node categories
      return a.depth - b.depth;
    }).slice(0, 5);
    _.map(keyword_treenodes, function(tn) {
      var bn = {
        BrowseNodeId: tn.data.id,
        Name: tn.data.name,
      };

      if (!node_counts[bn.BrowseNodeId]) node_counts[bn.BrowseNodeId] = 0
      node_counts[bn.BrowseNodeId] += 8;    // artificially inflate node counts
      // TODO this code is duped below
      pending_request_fns.push(function() {
        topSuggestionsForNode(bn, query, true, function(err, results, depth) {
          if (!err && results && results.length > 0) {
            top_gifted_items[bn.BrowseNodeId] = results;
            top_gifted_item_depths[bn.BrowseNodeId] = depth;
          }
          requestComplete();
        });
      });
    });

    // Fire request queue
    _.map(pending_request_fns, function(fn) {fn();});
  }
  else {
    // Loop through all of the top categories for this search result
    console.log('Using search browsenodes');
    amazonSearch(query, function(err, categories, bindings_map) {
      _.map(categories, function(cat) {
        winston.info('lookup category ' + cat);
        var items = bindings_map[cat];
        var seen = {};

        function checkNode(bn) {
          var name = bn.Name;
          if (!node_counts[bn.BrowseNodeId])
            node_counts[bn.BrowseNodeId] = 0;
          node_counts[bn.BrowseNodeId]++;

          // Don't query duplicate nodes
          if (seen[name] || EXCLUDE_NODES.indexOf(bn.Name) > -1) {
            return false;
          }

          pending_request_fns.push(function() {
            topSuggestionsForNode(bn, query, false, function(err, results, depth) {
              if (!err && results && results.length > 0) {
                top_gifted_items[bn.BrowseNodeId] = results;
                top_gifted_item_depths[bn.BrowseNodeId] = depth;
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
      _.map(pending_request_fns, function(fn) {fn();});
    });
  }
}

// callback(err, item, depth)
// force_search - generate gift suggestions for this browse node
// regardless of any rules on hierarchy position
function topSuggestionsForNode(bn, query, force_search, cb) {
  var node = hierarchy.getTreeNodeById(bn.BrowseNodeId);
  if (!node) {
    cb(new Error("Couldn't find browse node " + bn.BrowseNodeId), null, null);
    return;
  }

  // By default, we omit overly general browse nodes...must be at least N deep in hierarchy
  // but not when browse node name matches query name, eg. for 'Shopping'
  // TODO make this variable, based on average ancestor depth
  if (force_search || node.depth > 2 || query.toLowerCase() === bn.Name.toLowerCase()) {
    console.log('getting the top suggestions for', bn.Name);
    giftSuggestionsForNode(bn, function(err, items) {
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
}

function giftSuggestionsForNode(bn, cb) {
  bnLookup(bn, BN_LOOKUP_QUERY_STRING, function(err, results) {
    if (err) {
      cb(err, null);
      return;
    }
    if (!results.BrowseNodes.BrowseNode || !results.BrowseNodes.BrowseNode.TopItemSet) {
      console.log('skipped empty bn lookup for', bn.Name);
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

      // Top items of this list type
      //var best_item = item_set.TopItem[0];
      _.each(item_set.TopItem, function(best_item) {
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

function itemLookup(asin, cb) {
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/ItemLookup.html

  cache.getItemLookup(asin, function(err, reply) {
    if (!err && reply) {
      cb(null, reply)
      return;
    }

    opHelper.execute('ItemLookup', {
      'ItemId': asin,
      'ReviewSort': '-HelpfulVotes',
      'TruncateReviewsAt': 100,
      'ResponseGroup': 'Reviews,Offers,SalesRank,Images',
      }, function(error, result) {
        if (error) {
          winston.error('Error: ' + error + "\n")
          cb(error, null);
          return;
        }
        cache.saveItemLookup(asin, result);
        cb(null, result);
    });

  });
}

function bnLookup(bn, responsegroup, cb) {
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/BrowseNodeLookup.html
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/UsingSearchBinstoFindItems.html
  var bnkey = bn.BrowseNodeId + ':' + responsegroup;
  cache.getBNLookup(bnkey, function(err, reply) {
    if (!err && reply) {
      cb(null, reply)
      return;
    }

    opHelper.execute('BrowseNodeLookup', {
      'ResponseGroup': responsegroup,
      'BrowseNodeId': bn.BrowseNodeId,
      }, function(error, results) {
        if (error) {
          winston.error('Error: ' + error + "\n")
          cb(error, null);
          return;
        }
        cache.saveBNLookup(bnkey, results);
        cb(null, results);
    });
  });
}

function amazonSearch(query, cb) {
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
    if (results.Items.Request.IsValid === 'False') {
      winston.info(results.Items.Request.Errors);
      cb(err, null);
      return;
    }

    var bindings_count = {};
    var bindings_map = {};

    // Grab item bindings (categories) from general search results
    _.map(results.Items.Item, function(item) {
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
    // half of the most popular category
    categories = _.keys(bindings_count)
      .filter(function(a) {
        return true; //return (bindings_count[a] >= 2)
      })
      .sort(function(a, b) {
        return bindings_count[b] - bindings_count[a];
      })
      //.slice(0, 2);

    winston.info('categories count: ', bindings_count);
    winston.info('qualifying top categories: ', categories)

    //getTopGiftsForCategories(categories, bindings_map, query, cb);
    cb(null, categories, bindings_map);
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
