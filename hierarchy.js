// Amazon browse node hierarchy

var Arboreal = require('./lib/arboreal.js')
  , fs = require('fs')
  , _ = require('underscore')
  , assert = require('assert')

var bn_index = {};    // map from unique id to single node
var name_index = {};  // map from name to list of nodes
var tree;

(function loadHierarchyData() {
  tree = new Arboreal();

  var lines = fs.readFileSync('./data/browsenodes/all.txt', 'utf-8').split('\n');

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

    return true;  // all done
  }

  while (lines.length > 0) {
    var child_line = lines.shift();
    if (!process_line(child_line)) {
      lines.push(child_line);
    }
  }
  console.log('Success: Loaded browse node hierarchy.');
})()

function closestDistanceFromNodeName(bn_id, name) {
  var nodes = name_index[name.toLowerCase()];
  return _.min(_.map(nodes, function(node) {
    return distanceBetweenBrowseNodes(node.data.id, bn_id);
  }));
}

function distanceBetweenBrowseNodes(id_a, id_b) {
  // TODO right now this assumes one is in the subtree of the other
  var a = bn_index[id_a];
  var b = bn_index[id_b];

  if (!a)
    throw new Error('No such browse node: ' + id_a);
  if (!b)
    throw new Error('No such browse node: ' + id_b);

  function getDist(start_node, id_find) {
    var depth = Number.MAX_VALUE;
    var found_node = false;
    start_node.traverseDown(function(node) {
      if (node.data.id == id_find) {
        found_node = true;
        depth = node.depth - start_node.depth;
        return false;
      }
    });
    return depth;
  }

  return Math.min(getDist(a, id_b), getDist(b, id_a));
}

function browseNodeExists(name) {
  name = name.toLowerCase();
  return name_index[name] && name_index[name].length > 0;
}

module.exports = {
  browseNodeExists: browseNodeExists,
  closestDistanceFromNodeName: closestDistanceFromNodeName,
  distanceBetweenBrowseNodes: distanceBetweenBrowseNodes,
}

assert.equal(distanceBetweenBrowseNodes('2210604011','2206260011'), 1)
assert.equal(distanceBetweenBrowseNodes('374783011','3409906011'), 1)
assert.equal(closestDistanceFromNodeName('374783011','sports Collectibles'), 0)
assert.equal(closestDistanceFromNodeName('374790011','sports Collectibles'), 1)
