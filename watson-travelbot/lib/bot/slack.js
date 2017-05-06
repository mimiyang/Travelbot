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

var debug = require('debug')('bot:channel:slack');
var Botkit = require('botkit');
var slackify = require('slackify-html');

var slackBot = Botkit.slackbot();

module.exports = function (app, controller) {
  // spawn a slackbot bot instance
  var bot = slackBot.spawn({
    token: process.env.SLACK_TOKEN
  }).startRTM();

  debug('slack integration initialized');

  slackBot.hears('(.*)', 'direct_message,direct_mention,mention', function (bot, message) {
    debug('message: %s', JSON.stringify(message));
    controller.processMessage(message, function(err, response) {
      debug('response: %s', JSON.stringify(response));

      if (err) {
        bot.reply(message, 'There was a problem processing your message, please try again');
      } else {
        var responseText = "";
        for (var item in response.output.text) {
        			if (response.output.text[item].length !== 0) {
        					responseText = responseText + response.output.text[item] + "\n";
        			}
        }

        bot.reply(message, responseText);

        
        if (response.context.skyscanner_api) {
          delete response.context.skyscanner_api;

          if (response.context.outDate.indexOf('today') >= 0) {
            response.context.outDate = response.context.today;
          } else if (response.context.outDate.indexOf('tomorrow') >= 0) {
            response.context.outDate = response.context.tomorrow;
          }

          if (response.context.returnDate.indexOf('today') >= 0) {
            response.context.returnDate = response.context.today;
          } else if (response.context.returnDate.indexOf('tomorrow') >= 0) {
            response.context.returnDate = response.context.tomorrow;
          }

          controller.processFlightDetails(response, function(err, flightdata) {
            if (err) {

            } else {
              debug('Flight data: %s', JSON.stringify(flightdata));
              var responseText = "";

              for (var item in flightdata.output.text) {
              			if (flightdata.output.text[item].length !== 0) {
              					responseText = responseText + flightdata.output.text[item] + "\n";
              			}
              }

              //Properly display URL as clickable
              var slackifiedResponse = slackify(responseText);
              slackifiedResponse = slackifiedResponse.replace("<http://skyscanner.net|skyscanner.net>","skyscanner.net")
              debug("Slackified responseText: %s", slackifiedResponse);

              bot.reply(message, slackifiedResponse);
            }
          });
        }
      }
    });
  });
}
