//
// Amazon browse node hierarchy search and manipulation
//

var Arboreal = require('../lib/arboreal.js')
  , fs = require('fs')
  , _ = require('underscore')
  , assert = require('assert')
  , stemmer = require('porter-stemmer').stemmer

var bn_index = {};    // map from unique id to single node
var name_index = {};  // map from name to list of nodes
var names_set = [];  // set of browse node names
var tree;

(function loadHierarchyData() {

  function process_line(line) {
    // Returns true if parent has already been added and the node was added,
    // or if line is superfluous
    var parts = line.split('\t');
    if (parts.length < 4)
      return true;  // skip this line
    var name = parts[0].toLowerCase();
    var parent_id = parts[1];
    var id = parts[2];
    var product_group = parts[3];

    if (!id || !parent_id) {
      return true;  // skip this line
    }
    assert.notEqual(parent_id, id);

    var node;
    if (parent_id === 'null') {
      node = tree.appendChild({
        name: name,
        id: id,
      });
      node = node.children[node.children.length-1];
    }
    else {
      var parent_node = bn_index[parent_id];
      if (parent_node) {
        node = parent_node.appendChild({
          name: name,
          id: id,
        });
        node = node.children[node.children.length-1];
      }
      else {
        return false; // not done
      }
    }

    bn_index[id] = node;
    if (!name_index[name])
      name_index[name] = [];
    name_index[name].push(node);

    return true;  // all done with this line
  }

  tree = new Arboreal();
  var lines = fs.readFileSync('./data/browsenodes/all.txt', 'utf-8').split('\n');
  while (lines.length > 0) {
    var child_line = lines.shift();
    if (!process_line(child_line)) {
      lines.push(child_line);
    }
  }
  names_set = _.keys(name_index);
  console.log('Success: Loaded browse node hierarchy.');
})()

/*
function distanceToNodeName(bn_id, name) {
  var nodes = name_index[name.toLowerCase()];
  if (!nodes || nodes.length < 1)
    return Number.MAX_VALUE;
  return _.min(_.map(nodes, function(node) {
    return distanceBetweenBrowseNodes(node.data.id, bn_id);
  }));
}
*/

function distanceBetweenNodes(a, b) {
  // TODO right now this assumes one is in the subtree of the other
  function getDist(start_node, end_node) {
    var depth = Number.MAX_VALUE;
    start_node.traverseDown(function(node) {
      if (node.data.id === end_node.data.id) {
        depth = node.depth - start_node.depth;
        return false;
      }
    });
    return depth;
  }
  return Math.min(getDist(a, b), getDist(b, a));
}

function distanceBetweenNodeIds(id_a, id_b) {
  var a = bn_index[id_a];
  var b = bn_index[id_b];
  if (!a)
    throw new Error('No such browse node: ' + a);
  if (!b)
    throw new Error('No such browse node: ' + a);
  return Math.abs(a.depth - b.depth);
}

function distanceBetweenNodeNames(name_a, name_b) {
  var nodes_a = name_index[name_a.toLowerCase()];
  var nodes_b = name_index[name_b.toLowerCase()];
  if (!nodes_a || nodes_a.length < 1)
    return Number.MAX_VALUE;
  if (!nodes_b || nodes_b.length < 1)
    return Number.MAX_VALUE;

  // minimum distance from any node in A to any node in B
  return _.reduce(nodes_a, function(memo, node_a) {
    // minimum distance from this node in A to any node in B
    var min_dist = _.reduce(nodes_b, function(memo, node_b) {
      var d = distanceBetweenNodes(node_a, node_b);
      if (d < memo) return d;
      return memo;
    }, Number.MAX_VALUE);
    if (min_dist < memo) return min_dist;
    return memo;
  }, Number.MAX_VALUE);
}

function browseNodeExists(name) {
  name = name.toLowerCase();
  return name_index[name] && name_index[name].length > 0;
}

function fuzzyBrowseNodeMatch(search) {
  search = stemmer(search.toLowerCase());
  for (var i=0; i < names_set.length; i++) {
    var name = names_set[i];
    if (name.indexOf(search) > -1 || search.indexOf(name) > -1) {
      return true;
    }
  }
  return false;
}

function getTreeNodeById(bid) {
  return bn_index[bid];
}

module.exports = {
  browseNodeExists: browseNodeExists,
  distanceBetweenNodeNames: distanceBetweenNodeNames,
  fuzzyBrowseNodeMatch: fuzzyBrowseNodeMatch,
  getTreeNodeById: getTreeNodeById,
}

assert.equal(distanceBetweenNodeIds('2210604011','2206260011'), 1)
assert.equal(distanceBetweenNodeIds('374783011','3409906011'), 1)
//assert.equal(distanceToNodeName('374783011','sPorts Collectibles'), 0)
//assert.equal(distanceToNodeName('374790011','spoRts Collectibles'), 1)
assert.equal(distanceBetweenNodeNames('sports collectibles', 'hard hats'), 1);

function test(a,b) {
  console.log(a, b);
}
