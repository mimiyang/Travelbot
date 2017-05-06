/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/* This is the main control point of the entire workflow. 
It calls various APIs */

'use strict';

var debug = require('debug')('bot:controller');
var extend = require('extend');
var Promise = require('bluebird');
var conversation = require('./api/conversation');
var weather = require('./api/weather');
var nlpUnderstand = require('./api/nlp_understanding');
var skyscanner = require('./api/skyscanner');
var cloudant = require('./api/cloudant');
var format = require('string-template');
var pick = require('object.pick');

var sendMessageToConversation = Promise.promisify(conversation.message.bind(conversation));
var getUser = Promise.promisify(cloudant.get.bind(cloudant));
var saveUser = Promise.promisify(cloudant.put.bind(cloudant));
var extractCity = Promise.promisify(nlpUnderstand.extractCity.bind(nlpUnderstand));
var getForecast = Promise.promisify(weather.forecastByGeoLocation.bind(weather));
var getGeoLocation = Promise.promisify(weather.geoLocation.bind(weather));
var getFlightDetails = Promise.promisify(skyscanner.getFlightDetails.bind(skyscanner));


module.exports = {
  /**
   * Process messages from a channel and send a response to the user
   * @param  {Object}   message.user  The user
   * @param  {Object}   message.input The user meesage
   * @param  {Object}   message.context The conversation context
   * @param  {Function} callback The callback
   * @return {void}
   */

  processFlightDetails: function(_message, callback) {
    debug('0. Calling skyscanner API to get flight details...');
    return getFlightDetails({
        origin: _message.context.origin,
        destination: _message.context.destination,
        outbounddate: _message.context.outDate,
        inbounddate: _message.context.returnDate
    })
    .then(function(itinerary) {
      debug('skyscanner response: ' + JSON.stringify(itinerary));
      _message.output.text = itinerary.text;
      _message.context.summary = 'skyscanner results';
      callback(null, _message);
    })
    // Catch any issue we could have during all the steps above
    .catch(function (error) {
      debug(error);
      callback(error);
    });
  },

  processMessage: function(_message, callback) {

    /* This function takes the input details and adds the message to the database. It uses context keys 
    to retrieve infromation. */

    var message = extend({ input: {text: _message.text} }, _message);
    var input = message.text ? { text: message.text } : message.input;
    var user = message.user || message.from;

    debug('1. Process new message: %s.', JSON.stringify(message.input, null, 2));

    getUser(user).then(function(dbUser) {
      var context = dbUser ? dbUser.context : {};
      message.context = context;

      /* We use Natural Language Understanding API for extracting city from a user input. */

      return extractCity(input).then(function(city) {
        debug('2. input.text: %s, extracted city: %s.', input.text, JSON.stringify(city, null, 2));
        if (city) {
          if (!context.city) {
            context.city = city
          }
          //context.city.alternate_name = city.name;
        }
      })
      .then(function() {  
        if (context.city && !context.state) {
          return getGeoLocation(context.city)
          .then(function(geoLocatedCity) {
            debug('3. Geo location for: %s, is: %s.',
              context.city.name, JSON.stringify(geoLocatedCity, null, 2));
            extend(context.city, geoLocatedCity);
            context.city.number_of_states = Object.keys(context.city.states).length;
            if (context.city.number_of_states === 1) {
              context.state = Object.keys(context.city.states)[0];
            }
          });
        } else {
          debug('3. Skip Geo location because city is unknown.');
        }
      })
      .then(function() {
        debug('4. Send message to Conversation.');
        return sendMessageToConversation(message);
      })
      // 4. Process the response from Conversation
      .then(function(messageResponse) {
        debug('5. Conversation response: %s.', JSON.stringify(messageResponse, null, 2));
        // Check if this is a new weather query
        var responseContext = messageResponse.context;
        var idx = messageResponse.intents.map(function(x) {return x.intent; }).indexOf('get_weather');
        if (responseContext.new_city) { // New weather query
          debug('Replace city name');
          responseContext.city.name = responseContext.city.alternate_name;
          delete responseContext.weather_conditions;
          delete responseContext.state;
          delete responseContext.get_weather;
          delete responseContext.new_city;
          return getGeoLocation(responseContext.city)
          .then(function(geoLocatedCity) {
            extend(responseContext.city, geoLocatedCity);
            responseContext.city.number_of_states = Object.keys(responseContext.city.states).length;
            if (responseContext.city.number_of_states === 1) {
              responseContext.state = Object.keys(responseContext.city.states)[0];
            }
            message = {
              input: messageResponse.input,
              context: responseContext
            }
          })
          .then(function() {
            return sendMessageToConversation(message);
          })
        } else {
          return messageResponse;
        }
      })
      .then(function(messageResponse) {
        if (!messageResponse.context.get_weather) {
          debug('6. Not enough information to search for forecast.');
          return messageResponse;
        }

        // BEGIN update context for get_weather
        var loc = {
          city: messageResponse.context.city.name,
          state: messageResponse.context.state
        };
        var gLocation = messageResponse.context.city.states[loc.state];

        // Handle error for invalid state - TODO : More graceful handling in dialog
        if (!gLocation) {
          messageResponse.input = "Hello";
          return sendMessageToConversation(messageResponse);
        }
        messageResponse.context.city.states = pick(messageResponse.context.city.states, loc.state)
        messageResponse.context.city.number_of_states = 1
        delete messageResponse.context.get_weather;
        // END update context for get_weather

        return getForecast(gLocation)
        .then(function(forecast) {
          debug('6. Got forecast for %s', loc.city);
          messageResponse.context.weather_conditions = forecast;
          return sendMessageToConversation(messageResponse);
        })
      })
      .then(function(messageToUser) {
        debug('7. Save conversation context.');
         if (!dbUser) {
           dbUser = {_id: user};
         }
         dbUser.context = messageToUser.context;

        // /// BEGIN SKYSCANNER CODE
        // if (!dbUser) {
        //   dbUser = {_id: user};
        // }

        // // Copying context from messageToUser one by one, skipping skyscanner_api key
        // // No need to store the skyscanner_api context value. Only used to trigger
        // // 2nd request to obtain flight details from skyscanner
        dbUser.context = {};
        var keys = Object.keys(messageToUser.context);

        for (var i=0;i<keys.length;i++) {
           if (keys[i] != 'skyscanner_api') {
             debug('key ' + i + ': ' + keys[i]);
             dbUser.context[keys[i]] = messageToUser.context[keys[i]];
           }
         }

        return saveUser(dbUser)
        .then(function(data) {
          debug('7. Send response to the user.');
          messageToUser = extend(messageToUser, _message);
          callback(null, messageToUser);
        });
      })
    })
    // Catch any issue we could have during all the steps above
    .catch(function (error) {
      debug(error);
      callback(error);
    });
  }
}
