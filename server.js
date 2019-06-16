'use strict';

// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors'); //cross origin request sharing
const superagent = require('superagent');
const pg = require('pg');

// Application Setup
const PORT = process.env.PORT;
const DATABASE_URL = process.env.DATABASE_URL;

//SQL Database Setup
const client = new pg.Client(DATABASE_URL);
client.connect();
client.on('error', error => console.error(error));

const app = express();
app.use(cors());

app.get('/location', handleLocation);
app.get('/weather', handleWeather);


////////////////// LOCATION //////////////////////
function handleLocation (request, response){

  getLocation(request.query.data, client, superagent)
    .then(location => response.send(location))
    .catch(error => handleError(error, response))
}

function getLocation(query, client, superagent){
  return getStoredLocation(query, client)
    .then(location => {

      if (location){
        return location;
      } else {
        return getLocationFromApi(query, client, superagent);
      }
    });
}

function getStoredLocation(query, client){
  const sql = `SELECT * FROM locations WHERE search_query='${query}'`;

  return client
    .query(sql)
    .then(results => results.rows[0]);

}

function getLocationFromApi(query, client, superagent){
  const URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEO_API_KEY}`;

  console.log(URL);
  console.log(process.env.GEO_API_KEY)

  return superagent
    .get(URL)
    .then(response => new Location(query, response.body.results[0]))
    .then(location => cacheLocation(location, client));

}


function cacheLocation(location, client) {
  const insertSQL = `
        INSERT INTO locations (search_query, formatted_query, latitude, longitude)
        VALUES('${location.search_query}','${location.formatted_query}', ${location.latitude}, ${location.longitude})
        RETURNING id;
    `;


  return client.query(insertSQL).then(results => {
    console.log('location results id!!!!!!!', results.rows[0].id);
    location.id = results.rows[0].id;
    return location;
  });
}

function Location(query, geoData) {
  this.search_query = query;
  this.formatted_query = geoData.formatted_address;
  this.latitude = geoData.geometry.location.lat;
  this.longitude = geoData.geometry.location.lng;
}

////////////////////// WEATHER //////////////////////////////

function handleWeather(req, res) {


  console.log('************* handle weather', req.query.data);

  getForecasts(req.query.data.latitude, req.query.data.longitude, client, superagent)
    .then(forecasts => res.send(forecasts))
    .catch(error => handleError(error, res));
}

function getForecasts(query, client, superagent) {
    
  return checkStoredWeather(query, client).then(weathers => {
    
    //if weathers is found, return the weathers
    if (weathers.length > 0) {
      console.log("from cache ", weathers);
      return weathers;
    }

    //if weathers is not found, get Location from API
    else {
      return getWeatherFromAPI(query, client, superagent);
    }
  });
}

function checkStoredWeather(query, client) {

  const SQL = `SELECT * FROM weathers WHERE location_id=${id}`;
  return client.query(SQL).then(results => {
    return results.rows;
  });
}

function getWeatherFromAPI(query, client, superagent) {
  console.log("query from weather api function ", query);
  const URL = `https://api.darksky.net/forecast/${
    process.env.WEATHER_API_KEY
  }/${query.latitude},${query.longitude}`;
  return superagent
    .get(URL)
    .then(response => response.body.daily.data)
    .then(days => {
      return days.map(day => {
        let weather = new Weather(day);
        cacheWeather(weather, client, query.id);
        return weather;
      });
    });
}

function cacheWeather(weather, client, locationId) {
  console.log("caching weather data ", weather, locationId);
  const SQL = `INSERT INTO weathers (forecast, time, location_id) VALUES ('${
    weather.forecast
  }', '${weather.time}', ${locationId});`;
  return client.query(SQL).then(results => weather);
}

function Weather(dayData) {
  this.forecast = dayData.summary;
  this.time = new Date(dayData.time * 1000).toString().slice(0, 15);
}



function Weather(dayData) {
  this.forecast = dayData.summary;
  this.time = new Date(dayData.time * 1000).toString().slice(0, 15);

}
function handleError(error, response) {
  console.error(error);
  response.status(500).send('Nope!');
}


app.listen(PORT, () => console.log(`App is listening on ${PORT}`));
