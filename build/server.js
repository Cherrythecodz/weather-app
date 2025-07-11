const express = require('express');
const axios = require('axios');
const app = express();
const port = 3001;

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/', (req, res) => {
  res.json({ message: 'OpenWeatherMap proxy server running. Use /weather to fetch data.' });
});

// Geocoding endpoint
app.get('/geocode', async (req, res) => {
  const API_KEY = '3a1446ea822bb838d1ac94eb68e1c8f1'; // Use your OpenWeatherMap API key
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({ error: 'City is required' });
  }

  try {
    const GEOCODING_URL = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
    const response = await axios.get(GEOCODING_URL);
    const data = response.data[0];
    if (!data) {
      return res.status(404).json({ error: 'City not found' });
    }
    res.json({
      lat: data.lat,
      lon: data.lon,
      name: data.name || city,
    });
  } catch (error) {
    console.error('Geocoding error:', error.message, error.response?.status, error.response?.data);
    res.status(error.response?.status || 500).json({
      error: `Geocoding failed: ${error.message}`,
    });
  }
});

// Weather data endpoint
app.get('/weather', async (req, res) => {
  const API_KEY = '3a1446ea822bb838d1ac94eb68e1c8f1'; // Use your OpenWeatherMap API key
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Coordinates required' });
  }

  try {
    const WEATHER_URL = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely&units=metric&appid=${API_KEY}`;
    const response = await axios.get(WEATHER_URL);

    if (response.data.error) {
      console.log(`OpenWeatherMap error: ${response.data.error.message}`);
      return res.status(400).json({ error: response.data.error.message });
    }

    const data = response.data;
    console.log(`[${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}] Temp for ${data.timezone}: ${data.current.temp}°C`);

    const normalizedData = {
      city: data.timezone.split('/').pop() || 'Unknown',
      current: {
        temp: data.current.temp,
        feels_like: data.current.feels_like,
        clouds: data.current.clouds,
        weather: [
          {
            description: data.current.weather[0].description,
            main: data.current.weather[0].main,
          },
        ],
        humidity: data.current.humidity,
        visibility: data.current.visibility, // Direct from API (meters)
        uvi: data.current.uvi, // Direct from API
        wind_speed: data.current.wind_speed, // Direct from API (m/s)
        wind_gust: data.current.wind_gust || data.current.wind_speed * 1.2, // Use gust if available, else estimate
        pop: data.current.pop || data.hourly[0]?.pop || 0, // Probability of precipitation
      },
      hourly: data.hourly.slice(0, 24).map((hour) => ({
        dt: hour.dt,
        temp: hour.temp,
        clouds: hour.clouds,
        weather: [{ description: hour.weather[0].description }],
        humidity: hour.humidity,
        pop: hour.pop || 0,
      })),
      daily: data.daily.slice(0, 10).map((day) => ({
        dt: day.dt,
        temp: { day: day.temp.day },
        clouds: day.clouds,
        weather: [{ description: day.weather[0].description }],
        humidity: day.humidity,
        pop: day.pop || 0,
      })),
    };

    res.json(normalizedData);
  } catch (error) {
    console.error('Proxy error:', error.message, error.response?.status, error.response?.data);
    res.status(error.response?.status || 500).json({
      error: `Failed to fetch weather: ${error.message}`,
    });
  }
});

app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
});