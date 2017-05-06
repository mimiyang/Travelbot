
'use strict';

var NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');

var nlp_understand = new NaturalLanguageUnderstandingV1({
  username: process.env.NLP_UNDERSTANDING_USERNAME,
  password: process.env.NLP_UNDERSTANDING_PASSWORD,
  version_date: NaturalLanguageUnderstandingV1.VERSION_DATE_2017_02_27
});

var debug = require('debug')('bot:api:natural-language-understanding');

/**
 * Returns true if the entity.type is a city
 * @param  {Object}  entity Alchemy entity
 * @return {Boolean}        True if entity.type is a city
 */
function isCity(entity) {
   return entity.type === 'Location';
}

/**
 * Returns only the name property
 * @param  {Object}  entity Alchemy entity
 * @return {Object}  Only the name property
 */
function onlyName(entity) {
  return { name: entity.text };
}

module.exports = {
  /**
   * Extract the city mentioned in the input text
   * @param  {Object}   params.text  The text
   * @param  {Function} callback The callback
   * @return {void}
   */
  extractCity: function(params, callback) {
    params.language = 'english';
    nlp_understand.analyze(params, function(err, response) {
      //debug('text: %s, entities: %s', params.text, JSON.stringify(response.entities));
      if (err) {
        callback(err);
      }
      else {
        var cities = response.entities.filter(isCity).map(onlyName);
        callback(null, cities.length > 0 ? cities[0]: null);
      }
    })
  }
};