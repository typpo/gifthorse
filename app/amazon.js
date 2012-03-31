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

function search(keyword, opts, cb) {
  // Search Amazon for a keyword
  // TODO options:
  //  maxprice
  //  minprice
  //
  //sorting http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/SortingbyPopularityPriceorCondition.html
  //search http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/CommonItemSearchParameters.html

    runSearch(keyword);
    return;

  // stem and disambiguate
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
}

function runSearch(keyword) {
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
      // TODO instead of a threshold of 2, make it so that the threshold is
      // half as much as the next popular category
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
        winston.info('lookup category ' + cat);
        var items = bindings_map[cat];
        var seen = {};
        _.map(items, function(item) {
          var browsenode = item.BrowseNodes.BrowseNode;

          function addnode(bn) {
            if (bn.Name in seen ||
                EXCLUDE_NODES.indexOf(bn.Name) > -1) {
              return false;
            }

            //walkTree(bn.BrowseNodeId);
            gifted(bn, function() {

            });

            var name = bn.Name;
            if (!nodes[name])
              nodes[name] = 0;
            nodes[name]++;
            seen[name] = true;
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
      winston.info('top category browse nodes breakdown: ', nodes);
    }
  });
}

function walkTree(bid, cb) {
  // http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/FindingBrowseNodes.html

  //winston.info('Retrieving parent browse node for ' + bid + '...');

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

    console.log('\n');

    var ancestor = bn.Ancestors && bn.Ancestors.BrowseNode;
    while (ancestor) {
      if (!ancestor.Name) {
        // end of the line
        break;
      }
      console.log(ancestor.Name,
                  ancestor.IsCategoryRoot === '1' ? '(root)' : '',
                  '->');
      ancestor = ancestor.Ancestors && ancestor.Ancestors.BrowseNode;
    }

    console.log('***', bn.Name);

    // TODO children don't quite work the same - can have multiple children
    var child = bn.Children && bn.Children.BrowseNode;
    while (child) {
      if (!child.Name) {
        break;
      }
      console.log(child.Name, '->');
      child = child.Children && child.Children.BrowseNode;
    }

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

  bnLookup(bn, "MostGifted", cb);
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
      }
      console.log(bn.Name, '-->');
      //console.log(results.BrowseNodes.BrowseNode.TopSellers);
      console.log(results.BrowseNodes.BrowseNode)

      /*
      _.all(results.Items.Item, function(item) {
        winston.info(item);
        return false;
      });
      */

      cb(results);

  });
}

function spider() {
  _.each(amazon_util.TOP_LEVEL_NODES, function() {

    getChildNode(bid, function() {


    });

  });

}

function mineReviews() {

}

module.exports = {
  search: search,
}
