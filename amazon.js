var  _ = require('underscore')
  , OperationHelper = require('apac').OperationHelper
  , freebase = require('freebase')
  , winston = require('winston')
  , config = require('./config.js')

var opHelper = new OperationHelper({
  awsId:     config.amazon.key,
  awsSecret: config.amazon.secret,
  assocId:   config.amazon.associate,
});

var EXCLUDE_BINDINGS = ['Amazon Instant Video', 'Kindle Edition',
    'MP3 Download', 'Personal Computers', ];


function search(keyword, opts, cb) {
  // Search Amazon for a keyword
  // TODO options:
  //  maxprice
  //  minprice
  //
  //sorting http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/SortingbyPopularityPriceorCondition.html
  //search http://docs.amazonwebservices.com/AWSECommerceService/latest/DG/CommonItemSearchParameters.html

  freebase.search(keyword, console.log);

  console.log('Searching...', keyword);
  opHelper.execute('ItemSearch', {
    'SearchIndex': 'All',
    'Keywords': keyword,
    'ResponseGroup': 'ItemAttributes,Offers',
    'Availability': 'Available',
    //'MinimumPrice': 333.50,
    //'Sort': 'salesrank',
  }, function(error, results) {
    if (error) {
      console.log('Error: ' + error + "\n")
      return;
    }
    if (results.Items.Request.IsValid == 'False') {
      console.log(results.Items.Request.Errors);
    }
    else {
      var bindings = {};
      _.map(results.Items.Item, function(item) {
        var binding = item.ItemAttributes.Binding;
        if (!bindings[binding])
          bindings[binding] = 0;
        bindings[binding]++;
      });
      console.log(bindings);
      console.log(results.Items.Item.length);
    }
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
