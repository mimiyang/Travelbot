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

'use strict';
var debug = require('debug')('bot:api:skyscanner');
var format = require('string-template');
var extend = require('extend');
var request = require('request');
var Client = require('node-rest-client').Client;
var Localize = require('localize');
var moment = require('moment');


var SKYSCANNER_API_KEY = process.env.SKYSCANNER_API_KEY;
var SKYSCANNER_URL = process.env.SKYSCANNER_URL;
var SKYSCANNER_COUNTRY = process.env.SKYSCANNER_COUNTRY;
var SKYSCANNER_CURRENCY = process.env.SKYSCANNER_CURRENCY;
var SKYSCANNER_LOCALE = process.env.SKYSCANNER_LOCALE;
var SKYSCANNER_SCHEMA = process.env.SKYSCANNER_SCHEMA;

module.exports = {
  /**
   * Returns the Geo location based on a city name
   * @param  {array}   An array containing the 4 parameters: destination, origin, outbounddate and inbounddate
   * @param  {Function} callback The callback
   * @return {void}
   */
  getFlightDetails: function(params, callback) {
    if (Object.keys(params).length != 4) {
      callback('The skyscanner API call needs 4 input parameters: destination, origin, outbounddate and inbounddate');
    }

    debug('Parameters received: ' + JSON.stringify(params));

    // Prepare date fields
    var poll_url = '';
    var year = (new Date()).getFullYear();

    //Change to language
    moment.locale(process.env.CONVERSATION_LANG);

    var outboundDate = moment(params.outbounddate + year,"DD MMM YYYY");
    var outBoundMonth = new String(outboundDate.month() + 1).length < 2 ? '0'.concat((outboundDate.month() + 1)) : (outboundDate.month() + 1);
    var outBoundDay = new String(outboundDate.date()).length < 2 ? '0'.concat(outboundDate.date()) : outboundDate.date();

    debug('outbounddate: ' + year + '-' + outBoundMonth + '-' + outBoundDay);

    var inboundDate = moment(params.inbounddate + year,"DD MMM YYYY");
    var inBoundMonth = new String(inboundDate.month() + 1).length < 2 ? '0'.concat((inboundDate.month() + 1)) : (inboundDate.month() + 1);
    var inBoundDay = new String(inboundDate.date()).length < 2 ? '0'.concat(inboundDate.date()) : inboundDate.date();

    debug('inbounddate: ' + year + '-' + inBoundMonth + '-' + inBoundDay);

    // Send the input to the skyscanner service
    request({
      url: SKYSCANNER_URL, //URL to hit
      method: 'POST',
      //Lets post the following key/values as form
      form: {
              apiKey: SKYSCANNER_API_KEY,
              country: SKYSCANNER_COUNTRY,
              currency: SKYSCANNER_CURRENCY,
              locale: SKYSCANNER_LOCALE,
              originplace: params.origin,
              destinationplace: params.destination,
              locationschema: SKYSCANNER_SCHEMA,
              outbounddate: year + '-' + outBoundMonth + '-' + outBoundDay,
              inbounddate: year + '-' + inBoundMonth + '-' + inBoundDay
            }
    }, function(err,res) {
      if (err) {
        return res.status(err.code || 500).json(err);
      }
    }).on('complete', function(resp) {
      // Setting arguments for polling skyscanner API. Looking for cheapest direct flight
      var args = {
          parameters: {
                        apiKey: SKYSCANNER_API_KEY,
                        pageindex: 0,
                        pagesize: 3,
                        sortorder: "asc",
                        sorttype: "price",
                        stops: 0
                      }
      };

      var client = new Client();
      poll_url = resp.headers.location;

      if (poll_url === undefined) {
        callback(null, {text: ['There is no direct flight found for the specified dates. Please try again with other dates.']});
      } else {
        var inProgress = true;
        var i = 0, howManyTimes = 80;

        function pollSkyscanner() {
          if (inProgress) {
            debug( 'Polling skyscanner API using session url..');
            client.get(poll_url, args, function(data, response) {
              debug('polling...');

              if (response.statusCode == '200' && data.Status != 'undefined') {
                debug('status: ' + data.Status);
              }

              if (data.Status == 'UpdatesComplete') {
                debug('poll_url: ' + poll_url);

                inProgress = false;
                if (data.Itineraries[0] === undefined) {
                  callback(null, {text: ['There is no direct flight found for the specified dates. Please try again with other dates.']});
                } else {
                  var price = data.Itineraries[0].PricingOptions[0].Price;

                  // Initialize variables for outbound flight
                  var outboundCarrierId = '';
                  var outboundOperatorCarrierId = '';
                  var outboundOperatorCarrierName = '';
                  var outboundCarrierName = '';
                  var outboundCarrierCode = '';
                  var outboundFlightNumber = '';
                  var outboundDepature = '';
                  var outboundArrival = '';
                  var outboundLegId = data.Itineraries[0].OutboundLegId;

                  // Initialize variables for inbound flight
                  var inboundCarrierId = '';
                  var inboundOperatorCarrierId = '';
                  var inboundOperatorCarrierName = '';
                  var inboundCarrierName = '';
                  var inboundCarrierCode = '';
                  var inboundFlightNumber = '';
                  var inboundDepature = '';
                  var inboundArrival = '';
                  var inboundLegId = data.Itineraries[0].InboundLegId;
                  var inboundDate = '';

                  for (var i=0, l=data.Legs.length; i < l; i++) {
                    if (data.Legs[i].Id === outboundLegId) {
                      outboundDepature = data.Legs[i].Departure;
                      outboundArrival = data.Legs[i].Arrival;
                      outboundCarrierId = data.Legs[i].FlightNumbers[0].CarrierId;
                      outboundOperatorCarrierId = data.Legs[i].OperatingCarriers[0];
                      outboundFlightNumber = data.Legs[i].FlightNumbers[0].FlightNumber;
                    } else if (data.Legs[i].Id === inboundLegId) {
                      inboundDepature = data.Legs[i].Departure;
                      inboundArrival = data.Legs[i].Arrival;
                      inboundCarrierId = data.Legs[i].FlightNumbers[0].CarrierId;
                      inboundOperatorCarrierId = data.Legs[i].OperatingCarriers[0];
                      inboundFlightNumber = data.Legs[i].FlightNumbers[0].FlightNumber;
                    }
                  }

                  for (var i=0, l=data.Carriers.length; i < l; i++) {
                    if (data.Carriers[i].Id === outboundCarrierId) {
                      outboundCarrierName = data.Carriers[i].Name;
                      outboundCarrierCode = data.Carriers[i].Code;
                    }

                    if (data.Carriers[i].Id === outboundOperatorCarrierId) {
                      outboundOperatorCarrierName = data.Carriers[i].Name;
                    }

                    if (data.Carriers[i].Id === inboundCarrierId) {
                      inboundCarrierName = data.Carriers[i].Name;
                      inboundCarrierCode = data.Carriers[i].Code;
                    }

                    if (data.Carriers[i].Id === inboundOperatorCarrierId) {
                      inboundOperatorCarrierName = data.Carriers[i].Name;
                    }
                  }

                  callback(null, {text: ['We\'ve found a flight for you for ' + '<b>€' + Math.round(price) + '</b>.',
                                        ' ',
                                        'Outbound flight: ' + outboundCarrierCode + outboundFlightNumber + ' on ' + outboundDepature.substring(0,10) + ', ' + params.origin + ' ' + outboundDepature.substring(11,16) + ' -> ' + params.destination + ' ' + outboundArrival.substring(11,16),
                                        'Operated by: ' + '<i>' + outboundOperatorCarrierName + '</i>',
                                        ' ',
                                        'Inbound flight: ' + inboundCarrierCode + inboundFlightNumber + ' on ' + inboundDepature.substring(0,10) + ', ' + params.destination + ' ' + inboundDepature.substring(11,16) + ' -> '+ params.origin + ' ' + inboundArrival.substring(11,16),
                                        'Operated by: ' + '<i>' + inboundOperatorCarrierName + '</i>',
                                        ' ',
                                        'This service is powered by <b>IBM Watson</b> and Skyscanner.',
                                        'Go to <a href=\"http://skyscanner.net\">skyscanner.net</a> to actually book this flight.'
                  ]});
                }
              }
            })
          } else {
            i = howManyTimes; // Stop polling skyscanner, updates are complete
          }

          i++;

          if( i < howManyTimes ){
            setTimeout( pollSkyscanner, 2000 );
          }
        }
        pollSkyscanner();
      }
    })
  }
}