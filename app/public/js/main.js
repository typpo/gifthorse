if (typeof GH === 'undefined' || !GH) GH = {};

GH.Main = {
  search_running: false,
  last_result: null,
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
    $(this).addClass('disabled');

    $('#loading').show();
    $('#results').hide();
    $('#bottom').show();

    $.ajax({
      type: 'GET',
      url: '/lookup/' + $('#search1').val(),
      //data: data,
      success: function(data) {
        me.ParseResults(data);
      },
      error: function() {
        //alert('ajax error');
        $('#loading').hide();
        $('#results').empty().text('ajax error').show();
        $('#search').removeClass('disabled');
        me.search_running = false;
      },
      dataType: 'json'
    });

    return false;
  },

  ParseResults: function(data) {
    var me = this;
    console.log(data);
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
        score: Math.floor(result.score * 100)
      }));

      var feedback = function(attr) {
        me.ItemFeedback(data.qid, idx, result.item.ASIN, attr);
      }
      $row.find('.vote-like').on('click', function() {
        feedback('clickthrough');
      });
      $row.find('.vote-dislike').on('click', function() {
        feedback('clickhide');
      });
      $row.find('.vote-already-have').on('click', function() {
        feedback('clickalreadyhave');
      });
      $row.find('.vote-admin-boost').on('click', function() {
        feedback('clickadminboost');
      });
      $row.find('.vote-admin-deboost').on('click', function() {
        feedback('clickadmindeboost');
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
  },

};

$(function() {
  GH.Main.Init();
});
