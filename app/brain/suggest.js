//
// The interface for suggesting related SEARCH QUERIES
//

//var CSV_FILE = './data/turk/us/all.csv';
var CSV_FILE = './data/test/all.csv';

var fs = require('fs')
  , _ = require('underscore')
  //, stemmer = require('porter-stemmer').stemmer

var stemmer  = function(a) {return a;}; // placeholder because the other stemming shit sucks

var people = [];
(function loadGiftData() {
  var lines = fs.readFileSync(CSV_FILE, 'utf-8').split('\n');
  _.each(lines, function(line) {
    var parts = line.split(',');
    if (parts.length < 3) return true;
    var pid = parts[0],
      p1 = stemmer(parts[1].toLowerCase()),
      p2 = stemmer(parts[2].toLowerCase()),
      p3 = stemmer(parts[3].toLowerCase());

    // TODO clean more?

    var person = {};
    person[p1] = 1;
    person[p2] = 1;
    person[p3] = 1;
    people.push(person);
  });

  /*
  suggestions({
    cooking: 1,
    hiking: 1,
    camping: 1,
  }, 2);
  */
})();

function sum(arr) {
  return _.reduce(arr, function(memo, num){ return memo + num; }, 0);
}

function normalizePerson(person) {
  var normalized_person = {};
  for (var x in person) {
    normalized_person[stemmer(x.toLowerCase())] = person[x];
  }
  return normalized_person;
}

function bestMatchPerson(poi) {
  var normalized_person = normalizePerson(poi);
  return _.reduce(people, function(memo, person) {
    var pscore = pearson(normalized_person, person);
    if (pscore > memo[0])
      return [pscore, person];
    return memo;
  }, [0, {}]);
}

function suggestions(poi, n) {
  var normalized_person = normalizePerson(poi);

  var scores_for_queries = {};
  // compute weighted scores for each query
  _.map(people, function(person) {
    var pscore = pearson(normalized_person, person);
    //console.log(normalized_person, 'vs', person, '=', pscore);
    for (var q in person) {
      if (!scores_for_queries[q])
        scores_for_queries[q] = 0;
      scores_for_queries[q] += pscore * person[q];
    }
  });

  // choose the top N scores for queries
  return _.chain(scores_for_queries).keys().sort(function(a,b) {
    return scores_for_queries[b] - scores_for_queries[a];
  }).reject(function(x) {
    return x in normalized_person;
  }).slice(0, n).value();
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
function pearson(obj1, obj2) {
  var vs = [];
  var n = 0;
  for (val in obj1) {
    if (val in obj2) {
      vs.push([obj1[val], obj2[val]]);
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
  bestMatchPerson: bestMatchPerson,
  suggestions: suggestions,
}
