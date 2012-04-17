//
// The interface for suggesting related SEARCH QUERIES
//

var fs = require('fs')
  , _ = require('underscore')
  , stemmer = require('porter-stemmer').stemmer

var people = [];
(function loadGiftData() {
  var lines = fs.readFileSync('./data/turk/us/all.csv', 'utf-8').split('\n');
  _.each(lines, function(line) {
    var parts = line.split(',');
    if (parts.length < 3) return true;
    var p1 = stemmer(parts[0].toLowerCase()),
      p2 = stemmer(parts[1].toLowerCase()),
      p3 = stemmer(parts[2].toLowerCase());

    // TODO clean more

    var person = {};
    person[p1] = 1;
    person[p2] = 1;
    person[p3] = 1;
    people.push(person);
  });
})();

function sum(arr) {
  return _.reduce(arr, function(memo, num){ return memo + num; }, 0);
}

function bestMatch(poi) {
  var normalized_person = {};
  for (var x in poi) {
    normalized_person[stemmer(x.toLowerCase())] = poi[x];
  }
  return _.reduce(people, function(memo, person) {
    var pscore = pearson(personOfInterest, person);
    if (pscore < 1 && pscore > memo[0])
      return [pscore, person];
    return memo;
  }, [0, {}]);
}

// Calculates Pearson correlation between two objects of the form:
// {
//  attrName1: score,
// }
//
// eg.
// {
//  tigers: 1,
//  elephants: 2,
//  bears: 1,
// }
//
function pearson(v1, v2) {
  var vs = [];
  var n = 0;
  for (var i=0; i < v1.length; i++) {
    var val = v1[i];
    if (val in v2) {
      vs.push([v1[val], v2[val]]);
      n++;
    }
  }
  if (n < 1)
    return 0;

  var sum1=0,sum2=0,sum1_sq=0,sum2_sq=0,p_sum=0;
  for (var i=0; i < vs.length; i++) {
    var vv = vs[i];
    var v1 = vv[0],
        v2 = vv[1];

    sum1+=v1
    sum2+=v2
    sum1_sq+=v1*v1
    sum2_sq+=v2*v2
    p_sum+=v1*v2
  }

  // Calculate Pearson score
  var num = p_sum-(sum1*sum2/n)
  var temp = Math.max((sum1_sq-Math.pow(sum1,2)/n) * (sum2_sq-Math.pow(sum2,2)/n), 0)
  if (temp)
    return num / sqrt(temp);
  return 1;
}

module.export = {
  bestMatch: bestMatch,
}
