// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors'); //cross origin request sharing

// Application Setup
const PORT = process.env.PORT;
const DATABASE_URL = process.env.DATABASE_URL;

//SQL Database Setup
const pg = require('pg');
const client = new pg.Client(DATABASE_URL);
client.connect();
client.on('error', error => console.error(error));

const app = express();
const superagent = require('superagent');
app.use(cors());

app.get('/location', searchToLatLong);
app.get('/weather', handleWeather);

function handleWeather(request, response){
  searchTimeForcast(request.query)
    .then(data => {
      response.send(data)
      // console.log(data)
    })
    .catch(error => handleError(error, response))

}

function searchTimeForcast(query) {
  const URL = `https://api.darksky.net/forecast/${process.env.DARK_SKY_API}/${query.data.latitude},${query.data.longitude}`
  // console.log(URL)
  return superagent.get(URL)
    .then(response => response.body.daily.data.map(day => new Weather(day) ))
    .catch(error => handleError(error));
}



function searchToLatLong(request, response) {
  try {

    const URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEO_API_KEY}`;

    console.log(URL)

    return superagent.get(URL)

      .then(geoResponse => {
        const location = new Location(request.query.data, geoResponse.body);
        response.send(location);
      })
      .catch(error => {
        handleError(error, response);
      });
  }
  catch (error) {

    handleError(error, response);
  }
}


function Location(query, geoData) {
  this.search_query = query;
  this.formated_query = geoData.results[0].formatted_address;
  this.latitude = geoData.results[0].geometry.location.lat;
  this.longitude = geoData.results[0].geometry.location.lng;
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


