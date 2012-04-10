$(function() {

  var last_result = null;

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
        _.each(data, function(show_item) {
          var row = _.template($('#template-result').html(), {
            title: show_item.Title,
            link: show_item.DetailPageURL
          });
          resultdiv.append(row);
        });
        resultdiv.show();
      },
      error: function() {
        alert('ajax error');
      },
      dataType: 'json'
    });

    return false;
  });

});
