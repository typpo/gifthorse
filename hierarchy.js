// Amazon browse node hierarchy

var Arboreal = require('./lib/arboreal.js')
  , fs = require('fs')
  , _ = require('underscore')
  , assert = require('assert')

var bn_index = {};
var tree;

(function loadHierarchyData() {
  tree = new Arboreal();

  var lines = fs.readFileSync('./data/browsenodes/all.txt', 'utf-8').split('\n');
  var deferred_children = [];

  function process_line(line) {
    // Returns true if parent has already been added and the node was added,
    // or if line is superfluous
    var parts = line.split('|');
    if (parts.length < 4)
      return true;  // skip this line
    var name = parts[0];
    var parent_id = parts[1];
    var id = parts[2];
    var product_group = parts[3];

    if (!id || !parent_id) {
      return true;  // skip this line
    }
    assert.notEqual(parent_id, id);

    var node;
    if (parent_id === 'null') {
      node = tree.appendChild(name);
      node = node.children[node.children.length-1];
      bn_index[id] = node;
    }
    else {
      var parent_node = bn_index[parent_id];
      if (parent_node) {
        node = parent_node.appendChild(name);
        node = node.children[node.children.length-1];
      }
      else
        return false;
      bn_index[id] = node;
    }
    return true;
  }

  _.map(lines, process_line);

  while (deferred_children.length > 0) {
    var child_line = deferred_children.pop();

    if (!process_line(child_line)) {
      deferred_children.push(child_line);
    }
  }

  function iterator(node) {
    var depth = "", i;
    for (i = 1; i <= node.depth; i++) depth += ">>";
    console.log([depth, node.data].join(" "));
  }

  tree.traverseDown(iterator);
})()

function distanceFromNodeName(bn, name) {

}

function distanceFromBrowseNode(bn, bn_find) {

}

function browseNodeExists(name) {

}

module.exports = {
  distanceFromNodeName: distanceFromNodeName,
  browseNodeExists: browseNodeExists,

}
