
var topLevelNodes = [
  "Apparel & Accessories",
  "Appstore for Android",
  "Arts, Crafts & Sewing",
  "Automotive",
  "Baby",
  "Beauty",
  "Books",
  "Car Toys",
  "Cell Phones & Accessories",
  "Computer & Video Games",
  "Electronics",
  "Gifts & Wish Lists",
  "Gourmet and Grocery Food",
  "Health & Personal Care",
  "Home & Kitchen",
  "Home Improvement",
  "Industrial & Scientific",
  "Jewelry",
  "Kindle Store",
  "Kitchen & Housewares",
  "Magazine Subscriptions",
  "Movies & TV",
  "Music",
  "Musical Instruments",
  "Office Products",
  "Outlet",
  "Pet Supplies",
  "Shoes",
  "Software",
  "Sports & Outdoors",
  "Tools & Hardware",
  "Toys and Games",
  "Travel",
  "Warehouse Deals",
];

var OperationHelper = require('apac').OperationHelper;
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


module.exports = {
  TOP_LEVEL_NODES: topLevelNodes,

}
