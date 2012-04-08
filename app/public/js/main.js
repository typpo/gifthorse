$(function() {

  $('#search').on('click', function() {
    $('#loading').show();
    $('#results').hide();
    $('#bottom').show();

    setTimeout(function() {
      $('#loading').hide();
      $('#results').show();
    }, 2000);
  });

});
