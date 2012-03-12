var  _ = require('underscore')
  , OperationHelper = require('apac').OperationHelper
  , freebase = require('freebase')
  , winston = require('winston')
  , record = require('./record.js')
  , config = require('./config.js')

var opHelper = new OperationHelper({
  awsId:     config.amazon.key,
  awsSecret: config.amazon.secret,
  assocId:   config.amazon.associate,
});

var EXCLUDE_BINDINGS = ['Amazon Instant Video', 'Kindle Edition',
    'MP3 Download', 'Personal Computers', ];

var EXCLUDE_NODES = ['Just Arrived', 'All product'];

var MAP_BINDINGS = {
  'Blu-ray': 'Video',
  'DVD': 'Video',
}

function search(keyword, opts, cb) {
  // Search Amazon for a keyword
  // TODO options:
  //  maxprice
  //  minprice
  //
  //sorting http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/SortingbyPopularityPriceorCondition.html
  //search http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/CommonItemSearchParameters.html

  winston.info('Starting search with freebase');
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

    winston.info('Searching...', keyword);

    opHelper.execute('ItemSearch', {
      'SearchIndex': 'All',
      'Keywords': keyword,
      'ResponseGroup': 'ItemAttributes,Offers,BrowseNodes',
      'Availability': 'Available',
      //'MinimumPrice': 333.50,
      //'Sort': 'salesrank',
      //'BrowseNode'
    }, function(error, results) {
      if (error) {
        winston.info('Error: ' + error + "\n")
        return;
      }
      if (results.Items.Request.IsValid == 'False') {
        winston.info(results.Items.Request.Errors);
      }
      else {
        var bindings_count = {};
        var bindings_map = {};

        // Grab item bindings (categories) from general search results
        _.map(results.Items.Item, function(item) {
          //winston.info(item);

          var binding = item.ItemAttributes.Binding;
          binding = MAP_BINDINGS[binding] || binding;
          if (!binding || EXCLUDE_BINDINGS.indexOf(binding) > -1) {
            // ignore
          }
          else {
            if (!bindings_count[binding]) {
              bindings_count[binding] = 0;
              bindings_map[binding] = [];
            }
            bindings_count[binding]++;
            bindings_map[binding].push(item);
          }
        });

        winston.info('categories count: ', bindings_count);

        // Choose the most interesting/popular categories
        categories = _.keys(bindings_count)
          .filter(function(a) {
            return (bindings_count[a] >= 2)
          })
          .sort(function(a, b) {
            return bindings_count[b] - bindings_count[a];
          })
          .slice(0, 2);

        winston.info('qualifying top categories: ', categories)

        // Now grab the amazon browse nodes for these categories (bindings)
        var nodes = {};
        _.map(categories, function(cat) {
          var items = bindings_map[cat];
          _.map(items, function(item) {
            // TODO record parent node, not this node
            var browsenode = item.BrowseNodes.BrowseNode;

            function addnode(bn) {
              getParentNode(bn.BrowseNodeId);

              var name = bn.Name;
              if (!nodes[name])
                nodes[name] = 0;
              nodes[name]++;
            }

            if (_.isArray(browsenode)) {
              _.map(browsenode, addnode);
            }
            else {
              addnode(browsenode);
            }
          }); // end items loop
        }); // end categories loop

        // Nodes contains the browse nodes for all the items that were
        // in the top categories
        winston.info('browse nodes breakdown: ', nodes);
      }
    });
  });
}

function getParentNode(bid, cb) {

  winston.info('Retrieving parent browse node for ' + bid + '...');

  opHelper.execute('BrowseNodeLookup', {
    'BrowseNodeId': bid,
  }, function(error, results) {

    if (error) {
      winston.error('Error: ' + error + "\n")
    }

    //winston.info('browse node response', results);
    //console.log(results);

    var bn = results.BrowseNodes.BrowseNode;
    if (!bn) {
      console.log('no bn in: ');
      console.log(results);
      return;

    }
    var ancestor = bn.Ancestors;

    console.log(bn.Name, '-->');
    console.log(ancestor);

  });

}

function top(bid, cb) {
  // Gets top items for a browse node
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/TopSellers.html
  // TODO options:
  //  maxprice
  //  minprice
  //
  winston.log('Top items...');
  opHelper.execute('ItemSearch', {
    'SearchIndex': 'All',
    'Keywords': keyword,
    'ResponseGroup': 'ItemAttributes,Offers',
    'Availability': 'Available',
    'BrowseNode': bid,
    'Sort': 'salesrank',
    //'MinimumPrice': 333.50,
    }, function(error, results) {
    if (error) {
      winston.error('Error: ' + error + "\n")
    }
    _.all(results.Items.Item, function(item) {
      winston.info(item);
      return false;

    });

    });
}

function similar() {
  // Motivating customers to buy
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/CHAP_MotivatingCustomerstoBuy.html

}

module.exports = {
  search: search,
}
