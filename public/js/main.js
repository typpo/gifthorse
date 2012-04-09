$(function() {

  $('#search').on('click', function() {
    $('#loading').show();
    $('#results').hide();
    $('#bottom').show();


    $.ajax({
      type: 'GET',
      url: '/lookup/' + $('#search1').val(),
      //data: data,
      success: function(data) {
        $('#loading').hide();
        var resultdiv = $('#results');
        resultdiv.find('#item-title').text(data.Title);
        resultdiv.find('#item-link').attr('href', data.DetailPageURL);
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
