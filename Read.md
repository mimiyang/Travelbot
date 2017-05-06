
# travelbot_watson
# Motivation

Our project is a Travel Bot build using Watson Conversation Services and Bluemix PaaS. The goal for this project was to build a bot that helps you plan your travel, assisting you with information about the weather, flight bookings, search restaurants around. The way we accomplish this task is by training Watson Conversation model and integrating the conversation service with other APIs like Natural Language Understanding API, and other external APIs. 


![alt text](https://cloud.githubusercontent.com/assets/14323875/25767111/63061a5a-31bc-11e7-903f-fb9a445a52a9.png)
# Service 
-Bluemix PaaS

-Cloudant NoSQL DB

-Watson Conversation Service

-Watson Natural Language Understanding

-Weather Data Company
# Configuration and Development

![alt text](https://cloud.githubusercontent.com/assets/14323875/25767006/bb273ac6-31bb-11e7-843b-fbc0588bd1f6.jpg)


# Applications Intergrated with the Watson conversation service. 

-APIs 

Watson Conservation Service: To train the core conversation model. 

https://www.ibm.com/watson/developercloud/natural-language-understanding/api/v1/#introduction: To extract city information entered using entities and features from analyze method.  

Cloudant NoSQL DB: Database used to store and retrieve contexts.

Weather Data Company: Gives weather insights using GeoLocation and Weather Forecast. 

Skyscanner: Gets the cheap flights to and fro. (Currently, not working) 

Botkit-middleware: Integrate Watson Conversation workspace with Slack. 

-Interfaces 

Web UI: Using nodejs, we integrated our API code and trained model. The interface is a direct implementation found at watson repo.

Slack: Send direct messages to Slack Real Time Messenger and get responses from Watson Conversation workspace in our project.

# Installation

On Command Line
 
cd watson-travelbot

npm install

npm start

Go to localhost:3000

cf push

On Bluemix Platform

Go to https://travelbot-catalan.mybluemix.net/  

On Slack

The Chat bot works through Slack Real Time Messenger. It enables the active Communication. 
Here the middleware plugin for Botkit are used to allow developers to easily integrate a Watson Conversation workspace with multiple social channels like Slack, Facebook, and Twilio. 

cd botkit-middleware file

cd to src file and run the command: node slack.js

# Reference

https://github.com/watson-developer-cloud/botkit-middleware
https://github.com/watson-developer-cloud/text-bot
https://github.com/eciggaar/text-bot
https://www.youtube.com/watch?v=MTCc4d-RXP0    
https://www.ibm.com/watson/developercloud/doc/conversation/sample-applications.html 
https://partners.skyscanner.net/travel-apis/
https://www.ibm.com/watson/developercloud/natural-language-understanding/api/v1/#introduction

