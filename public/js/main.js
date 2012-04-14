$(function() {

  var last_result = null;
  $('#search1').focus();

  $('#search').on('click', function() {
    $('#loading').show();
    $('#results').hide();
    $('#bottom').show();


    $.ajax({
      type: 'GET',
      url: '/lookup/' + $('#search1').val(),
      //data: data,
      success: function(data) {
        console.log(data);
        last_result = data;

        $('#loading').hide();

        var resultdiv = $('#results').empty();
        var sorted_results = data.sort(function(a,b) {
          return b.score - a.score;
        });
        _.each(sorted_results, function(result) {
          var row = _.template($('#template-result').html(), {
            title: result.item.Title,
            link: result.item.DetailPageURL,
            type: result.item.type,
            score: Math.floor(result.score * 100)
          });
          resultdiv.append(row);
        });
        resultdiv.show();
      },
      error: function() {
        //alert('ajax error');
        $('#loading').hide();
        $('#results').empty().text('ajax error').show();
      },
      dataType: 'json'
    });

    return false;
  });

});
