// The Api module is designed to handle all interactions with the server
/* global XMLHttpRequest*/

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

var Api = (function() {
  var uuid = guid();
  var requestPayload;
  var responsePayload;
  var messageEndpoint = '/api/message';
  var skyscannerEndpoint = '/api/skyscanner';


  //Send a message request to the server
  function sendRequest(text, context) {
    // Build request payload
    var payloadToWatson = {};
    if (text) {
      payloadToWatson.input = {
        text: text,
        features: {
          entities:{
            sentiment: true
          }
        }
      };
    }
    if (context) {
      payloadToWatson.context = context;
    }
    payloadToWatson.user = uuid;
    
    // Built http request
    var http = new XMLHttpRequest();
    http.open('POST', messageEndpoint, true);
    http.setRequestHeader('Content-type', 'application/json');
    http.onreadystatechange = function() {
      if (http.readyState === 4 && http.status === 200 && http.responseText) {
        Api.setResponsePayload(http.responseText);
      }
    };

    var params = JSON.stringify(payloadToWatson);
    // Stored in variable (publicly visible through Api.getRequestPayload)
    // to be used throughout the application
    if (Object.getOwnPropertyNames(payloadToWatson).length !== 0) {
      Api.setRequestPayload(params);
    }

    // Send request
    http.send(params);
  }

  // Skyscanner Flight Request API
  function requestFlightDetails(payloadToWatson) {
    // Built http request
    var http = new XMLHttpRequest();

    http.open('POST', skyscannerEndpoint, true);
    http.setRequestHeader('Content-type', 'application/json');

    http.onreadystatechange = function() {
      if (http.readyState === 4 && http.status === 200 && http.responseText) {
        Api.setResponsePayload(http.responseText);
      }
    };

    var params = JSON.stringify(payloadToWatson);

    http.send(params);
  }



  // Publicly accessible methods defined
  return {
    sendRequest: sendRequest,

    // The request/response getters/setters are defined here to prevent internal methods
    // from calling the methods without any of the callbacks that are added elsewhere.
    getRequestPayload: function() {
      return requestPayload;
    },
    setRequestPayload: function(newPayloadStr) {
      requestPayload = JSON.parse(newPayloadStr);
    },
    getResponsePayload: function() {
      return responsePayload;
    },
    setResponsePayload: function(newPayloadStr) {
      // responsePayload = JSON.parse(newPayloadStr);

      var newPayload = JSON.parse(newPayloadStr);

      //Quick and dirty check on language :-)
      if (newPayload.context) {
        if (newPayload.context.skyscanner_api) {
          delete newPayload.context.skyscanner_api;
          if (newPayload.context.outDate.indexOf('today') >= 0) {
            newPayload.context.outDate = newPayload.context.today;
          } else if (newPayload.context.outDate.indexOf('tomorrow') >= 0 ) {
            newPayload.context.outDate = newPayload.context.tomorrow;
          }

          if (newPayload.context.returnDate.indexOf('today') >= 0 ) {
            newPayload.context.returnDate = newPayload.context.today;
          } else if (newPayload.context.returnDate.indexOf('tomorrow') >= 0 ) {
            newPayload.context.returnDate = newPayload.context.tomorrow;
          }

          requestFlightDetails(newPayload);
        }
      }

      responsePayload = newPayload;
    }
  };

}());
