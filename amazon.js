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

var EXCLUDE_NODES = ['Just Arrived'];

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

  freebase.search(keyword, function(freebase_results) {
    console.log(freebase_results);

    if (freebase_results.length > 0) {
      if (freebase_results.length > 1
        && freebase_results[0].search.score
          - freebase_results[1].search.score < 2.0) {
        // don't coerce; too close
        // remember this so we can improve later
        record.ambiguous_query(keyword);
      }
      else {
        console.log('Coercing', keyword, 'to', freebase_results[0].name);
        // put in list for classifer training later
        record.coercion(keyword, freebase_results[0].name);
        keyword = freebase_results[0].name;
      }
    }

    console.log('Searching...', keyword);
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
        console.log('Error: ' + error + "\n")
        return;
      }
      if (results.Items.Request.IsValid == 'False') {
        console.log(results.Items.Request.Errors);
      }
      else {
        var bindings_count = {};
        var bindings_map = {};

        // Grab item bindings (categories) from general search results
        _.map(results.Items.Item, function(item) {
          //console.log(item);

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

        console.log(bindings_count);

        // Choose the most interesting/popular categories
        categories = _.keys(bindings_count)
          .filter(function(a) {
            return (bindings_count[a] >= 2)
          })
          .sort(function(a, b) {
            return bindings_count[b] - bindings_count[a];
          })
          .slice(0, 2);

        console.log(categories)

        // Now grab the amazon browse nodes for these categories (bindings)
        var nodes = {};
        _.map(categories, function(cat) {
          var items = bindings_map[cat];
          _.map(items, function(item) {
            // TODO record parent node, not this node
            var browsenode = item.BrowseNodes.BrowseNode;
            function addnode(bn) {
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
        console.log(nodes);
      }
    });
  });
}

function top(browsenode, cb) {
  // Gets top items for a browse node
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/TopSellers.html
  // TODO options:
  //  maxprice
  //  minprice
  //
  winston.log('Top items...');
  opHelper.execute('BrowseNodeLookup', {
    'BrowseNodeId': '20',
    'ResponseGroup': 'BrowseNodes,TopSellers',
  }, function(error, results) {
    if (error) {
      winston.error('Error: ' + error + "\n")
    }
    _.all(results.Items.Item, function(item) {
      console.log(item);
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
