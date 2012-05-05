if (typeof GH === 'undefined' || !GH) GH = {};

GH.Main = {
  search_running: false,
  last_result: null,
  gifted_markup: {
    //'MostGifted': '&#x2713; This item is a top Amazon gift',
    'MostWishedFor': '&#x2713; This item appears on many Amazon wish lists',
    'TopSellers': '&#x2713; This item is a top seller'
  },
  Init: function() {
    var me = this;
    me.last_result = null;
    me.search_running = false;

    $('#search1').focus();
    $('#search').on('click', function() {
      me.DoSearch();
      return false;
    });
  },

  DoSearch: function() {
    var me = this;
    if (me.search_running) return false;
    me.search_running = true;
    $('#search').addClass('disabled');

    $('#loading').show();
    $('#results').hide();
    $('#bottom').show();

    var search1 = $('#search1').val();
    var search2 = $('#search2').val();
    $.ajax({
      type: 'GET',
      url: '/lookup/' + search1 + ',' + search2,
      //data: data,
      success: function(data) {
        me.ParseResults(data);
      },
      error: function() {
        $('#loading').hide();
        $('#results').empty().text('Sorry, there was a problem getting your search results. :(').show();
        $('#search').removeClass('disabled');
        me.search_running = false;
      },
      dataType: 'json'
    });

    mixpanel.track('search', {q1: search1, q2: search2});

    return false;
  },

  ParseResults: function(data) {
    var me = this;
    me.last_result = data;
    $('#loading').hide();

    var resultdiv = $('#results').empty();
    var sorted_results = data.results.sort(function(a,b) {
      return b.score - a.score;
    });

    _.each(sorted_results, function(result, idx) {
      var $row = $(_.template($('#template-result').html(), {
        title: result.item.Title,
        link: result.item.DetailPageURL,
        type: result.item.type,
        type_html: me.ItemTypeToHTML(result.item.type),
        bn: result.bName,
        image: result.image,
        score: Math.floor(result.score * 100)
      }));

      var feedback = function(attr) {
        me.ItemFeedback(data.qid, idx, result.item.ASIN, attr);
      }

      $row.find('.vote-like').on('click', function() {
        feedback('clickthrough');
      }).attr('href', result.item.DetailPageURL);
      $row.find('.vote-dislike').on('click', function() {
        feedback('clickhide');
        $(this).parent().parent().parent().parent().hide('fast');
      });
      $row.find('.vote-already-have').on('click', function() {
        feedback('clickalreadyhave');
      });
      $row.find('.vote-admin-boost').on('click', function() {
        feedback('clickadminboost');
        $(this).parent().parent().parent().parent().parent().hide('fast');
      });
      $row.find('.vote-admin-deboost').on('click', function() {
        feedback('clickadmindeboost');
        $(this).parent().parent().parent().parent().parent().hide('fast');
      });

      resultdiv.append($row);
    });

    resultdiv.show();
    $('#search').removeClass('disabled');
    me.search_running = false;
  },

  ItemFeedback: function(qid, rid, asin, verb) {
    $.ajax({
      type: 'GET',
      url: '/click/' + qid + '/' + rid + '/' + asin + '/' + verb,
      success: function(data) {
      },
      error: function() {
      },
      dataType: 'json'
    });
    mixpanel.track('click', {
      qid: qid,
      rid: rid,
      asin: asin,
      verb: verb
    });
  },

  ItemTypeToHTML: function(type) {
    var ret = '';
    var added = false;
    for (var i=0; i < type.length; i++) {
      var html  = this.gifted_markup[type[i]];
      if (html) {
        if (!added) {
          added = true;
          ret += html;
        }
        else
          ret += '<br>' + html;
      }
    }
    return ret;
  },

  _dummy: undefined
};

$(function() {
  GH.Main.Init();
});
