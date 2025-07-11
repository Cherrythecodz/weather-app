import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import SunRays from './assets/sun-rays.png';
import DashboardBgSunny from './assets/dashboard_bg_sunny.png';
import WeatherBgSunny from './assets/weather_bg_sunny.png';
import DashboardBgCloudy from './assets/dashboard_bg_cloudy.png';
import WeatherBgCloudy from './assets/weather_bg_cloudy.png';
import DashboardBgRainy from './assets/dashboard_bg_rainy.png';
import WeatherBgRainy from './assets/weather_bg_rainy.png';
import DashboardBgWindy from './assets/dashboard_bg_windy.png';
import WeatherBgWindy from './assets/weather_bg_windy.png';
import DashboardBgSnowy from './assets/dashboard_bg_snowy.png';
import WeatherBgSnowy from './assets/weather_bg_snowy.png';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  Filler,
} from 'chart.js';

ChartJS.register(LineElement, PointElement, LinearScale, Title, Tooltip, Legend, CategoryScale, Filler);

const CACHE_KEY = 'weatherData';
const CACHE_DURATION = 1 * 60 * 1000; // 1 minute

// Custom Slider Component
const CustomSlider = ({ wrapperRef }) => {
  const slidingBarRef = useRef(null);
  const staticBarRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const slidingBar = slidingBarRef.current;
    const staticBar = staticBarRef.current;
    const wrapper = wrapperRef.current;

    if (!slidingBar || !staticBar || !wrapper) return;

    const updateSliderPosition = () => {
      const wrapperWidth = wrapper.scrollWidth - wrapper.clientWidth;
      const scrollRatio = wrapper.scrollLeft / wrapperWidth;
      const staticBarWidth = staticBar.clientWidth;
      const slidingBarWidth = slidingBar.clientWidth;
      const maxLeft = staticBarWidth - slidingBarWidth;
      slidingBar.style.left = `${scrollRatio * maxLeft}px`;
    };

    const startDragging = (e) => {
      setIsDragging(true);
      e.preventDefault();
    };

    const drag = (e) => {
      if (!isDragging) return;
      const staticBarRect = staticBar.getBoundingClientRect();
      const slidingBarWidth = slidingBar.clientWidth;
      let newLeft = e.clientX - staticBarRect.left - slidingBarWidth / 2;
      if (newLeft < 0) newLeft = 0;
      if (newLeft > staticBarRect.width - slidingBarWidth) {
        newLeft = staticBarRect.width - slidingBarWidth;
      }
      slidingBar.style.left = `${newLeft}px`;
      const scrollRatio = newLeft / (staticBarRect.width - slidingBarWidth);
      wrapper.scrollLeft = scrollRatio * (wrapper.scrollWidth - wrapper.clientWidth);
    };

    const stopDragging = () => {
      setIsDragging(false);
    };

    const touchStart = (e) => {
      setIsDragging(true);
      e.preventDefault();
    };

    const touchMove = (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const staticBarRect = staticBar.getBoundingClientRect();
      const slidingBarWidth = slidingBar.clientWidth;
      let newLeft = touch.clientX - staticBarRect.left - slidingBarWidth / 2;
      if (newLeft < 0) newLeft = 0;
      if (newLeft > staticBarRect.width - slidingBarWidth) {
        newLeft = staticBarRect.width - slidingBarWidth;
      }
      slidingBar.style.left = `${newLeft}px`;
      const scrollRatio = newLeft / (staticBarRect.width - slidingBarWidth);
      wrapper.scrollLeft = scrollRatio * (wrapper.scrollWidth - wrapper.clientWidth);
    };

    const touchEnd = () => {
      setIsDragging(false);
    };

    slidingBar.addEventListener('mousedown', startDragging);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDragging);
    slidingBar.addEventListener('touchstart', touchStart);
    document.addEventListener('touchmove', touchMove);
    document.addEventListener('touchend', touchEnd);
    wrapper.addEventListener('scroll', updateSliderPosition);

    updateSliderPosition();

    return () => {
      slidingBar.removeEventListener('mousedown', startDragging);
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', stopDragging);
      slidingBar.removeEventListener('touchstart', touchStart);
      document.removeEventListener('touchmove', touchMove);
      document.removeEventListener('touchend', touchEnd);
      wrapper.removeEventListener('scroll', updateSliderPosition);
    };
  }, [isDragging, wrapperRef]);

  return (
    <div className="slider-container">
      <div className="static-bar" ref={staticBarRef}>
        <div className="sliding-bar" ref={slidingBarRef}></div>
      </div>
    </div>
  );
};

const App = () => {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState({ lat: null, lon: null });
  const [selectedHourlyIndex, setSelectedHourlyIndex] = useState(0);
  const [selectedTenDayIndex, setSelectedTenDayIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState(null);
  const hourlyWrapperRef = useRef(null);
  const tenDayWrapperRef = useRef(null);

  // Fetch coordinates for a city using backend API
  const fetchCoordinates = async (city) => {
    try {
      const response = await fetch(`http://localhost:3001/geocode?city=${encodeURIComponent(city)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return { lat: data.lat, lon: data.lon, name: data.name };
    } catch (err) {
      throw new Error(`Geocoding failed: ${err.message}`);
    }
  };

  // Fetch weather data using backend API
  const fetchWeatherData = async (lat, lon, cityName) => {
    if (!lat || !lon) {
      setError('Location not available');
      setLoading(false);
      return;
    }

    const cacheKey = `${CACHE_KEY}_${lat}_${lon}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        console.log(`Using cached temperature: ${data.current.temp}°C for ${cityName || data.city}`);
        setWeatherData(data);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/weather?lat=${lat}&lon=${lon}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      console.log(`Frontend received temperature: ${data.current.temp}°C for ${cityName || data.city}`);

      setWeatherData(data);
      localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      setLoading(false);
    } catch (err) {
      setError(`Failed to fetch weather: ${err.message}`);
      setLoading(false);
    }
  };

  // Handle search submission
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchError('Please enter a city name');
      return;
    }
    setSearchError(null);
    setLoading(true);
    try {
      const { lat, lon, name } = await fetchCoordinates(searchQuery.trim());
      setLocation({ lat, lon });
      localStorage.removeItem(`${CACHE_KEY}_${lat}_${lon}`);
      await fetchWeatherData(lat, lon, name);
      setSearchQuery('');
    } catch (err) {
      setSearchError(err.message);
      setLoading(false);
    }
  };

  // Get geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported.');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        localStorage.removeItem(`${CACHE_KEY}_${latitude}_${longitude}`);
        setLocation({ lat: latitude, lon: longitude });
      },
      () => {
        setError('Geolocation denied. Please enable location access.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Fetch weather when location updates
  useEffect(() => {
    if (location.lat && location.lon) fetchWeatherData(location.lat, location.lon);
  }, [location]);

  // Helper to determine weather condition
  const getCondition = (cloudCover) => {
    if (cloudCover < 20) return 'Sunny';
    if (cloudCover < 50) return 'Partly Cloudy';
    if (cloudCover < 80) return 'Mostly Cloudy';
    return 'Cloudy';
  };

  // Determine background images based on weather
  const getBackgroundImages = (weatherData) => {
    if (!weatherData?.current) {
      return {
        dashboardBg: DashboardBgSunny,
        weatherBg: WeatherBgSunny,
      };
    }

    const condition = getCondition(weatherData.current.clouds);
    const mainWeather = weatherData.current.weather?.[0]?.main || '';
    const windSpeed = weatherData.current.wind_speed || 0;

    if (windSpeed >= 15) {
      return {
        dashboardBg: DashboardBgWindy,
        weatherBg: WeatherBgWindy,
      };
    }

    if (mainWeather === 'Rain') {
      return {
        dashboardBg: DashboardBgRainy,
        weatherBg: WeatherBgRainy,
      };
    }

    if (mainWeather === 'Snow') {
      return {
        dashboardBg: DashboardBgSnowy,
        weatherBg: WeatherBgSnowy,
      };
    }

    if (condition.includes('Cloudy')) {
      return {
        dashboardBg: DashboardBgCloudy,
        weatherBg: WeatherBgCloudy,
      };
    }

    return {
      dashboardBg: DashboardBgSunny,
      weatherBg: WeatherBgSunny,
    };
  };

  // Current weather data
  const currentWeather = weatherData?.current
    ? {
        name: weatherData.city || 'New York, NY',
        temperature: `${Math.round(weatherData.current.temp)}°C`,
        condition: getCondition(weatherData.current.clouds),
        ...getBackgroundImages(weatherData),
      }
    : {
        name: 'New York, NY',
        temperature: '22°C',
        condition: 'Partly Cloudy',
        dashboardBg: DashboardBgSunny,
        weatherBg: WeatherBgSunny,
      };

  console.log(`[${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}] Displaying temperature: ${currentWeather.temperature} for ${currentWeather.name}`);

  // Dynamic captions for metrics
  const getVisibilityNote = (visibility) => {
    const visKm = parseFloat(visibility);
    if (visKm >= 10) return 'Excellent visibility';
    if (visKm >= 5) return 'Good visibility';
    if (visKm >= 1) return 'Reduced visibility, drive carefully';
    return 'Poor visibility, use fog lights';
  };

  const getHumidityNote = (humidity) => {
    const hum = parseFloat(humidity);
    if (hum <= 30) return 'Low humidity, stay hydrated';
    if (hum <= 60) return 'Comfortable humidity';
    if (hum <= 80) return 'High humidity, may feel sticky';
    return 'Very humid, expect discomfort';
  };

  const getPrecipitationNote = (pop) => {
    const precip = parseFloat(pop);
    if (precip <= 10) return 'Low chance of rain';
    if (precip <= 30) return 'Slight chance of showers';
    if (precip <= 60) return 'Rain possible, carry an umbrella';
    return 'High chance of rain, prepare for wet conditions';
  };

  // Metrics data with dynamic notes
  const metrics = weatherData?.current
    ? [
        { label: 'Feels Like', value: `${Math.round(weatherData.current.feels_like)}°C`, note: Math.abs(weatherData.current.feels_like - weatherData.current.temp) > 3 ? 'Noticeably different from actual temp' : 'Similar to actual temp', icon: 'temperature' },
        { label: 'Visibility', value: `${(weatherData.current.visibility / 1000).toFixed(1)} km`, note: getVisibilityNote(weatherData.current.visibility / 1000), icon: 'eye' },
        { label: 'Humidity', value: `${weatherData.current.humidity}%`, note: getHumidityNote(weatherData.current.humidity), icon: 'water' },
        { label: 'Precipitation', value: `${(weatherData.current.pop * 100).toFixed(0)}%`, note: getPrecipitationNote(weatherData.current.pop * 100), icon: 'wet' },
      ]
    : [
        { label: 'Feels Like', value: '21°C', note: 'Similar to actual temp', icon: 'temperature' },
        { label: 'Visibility', value: '10 km', note: 'Excellent visibility', icon: 'eye' },
        { label: 'Humidity', value: '65%', note: 'Comfortable humidity', icon: 'water' },
        { label: 'Precipitation', value: '5%', note: 'Low chance of rain', icon: 'wet' },
      ];

  // Hourly forecast data
  const hourlyForecast = weatherData?.hourly
    ? weatherData.hourly.slice(0, 24).map((item) => ({
        time: new Date(item.dt * 1000).toLocaleTimeString([], { hour: 'numeric', hour12: true }),
        temp: `${Math.round(item.temp)}°C`,
        tempValue: Math.round(item.temp),
        icon: 'sun-rays',
      }))
    : Array.from({ length: 24 }, (_, i) => ({
        time: new Date(Date.now() + i * 3600000).toLocaleTimeString([], { hour: 'numeric', hour12: true }),
        temp: `${22 + (i % 2)}°C`,
        tempValue: 22 + (i % 2),
        icon: 'sun-rays',
      }));

  // 10-day forecast data
  const tenDayForecast = weatherData?.daily
    ? weatherData.daily.slice(0, 10).map((item, index) => ({
        day: index === 0 ? 'Today' : new Date(item.dt * 1000).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
        temp: `${Math.round(item.temp.day)}°C`,
        tempValue: Math.round(item.temp.day),
        icon: 'sun-rays',
      }))
    : [
        { day: 'Today', temp: '24°C', tempValue: 24, icon: 'sun-rays' },
        { day: 'Sun, Jun 15', temp: '23°C', tempValue: 23, icon: 'sun-rays' },
        { day: 'Mon, Jun 16', temp: '21°C', tempValue: 21, icon: 'sun-rays' },
        { day: 'Tue, Jun 17', temp: '22°C', tempValue: 22, icon: 'sun-rays' },
        { day: 'Wed, Jun 18', temp: '23°C', tempValue: 23, icon: 'sun-rays' },
        { day: 'Thu, Jun 19', temp: '24°C', tempValue: 24, icon: 'sun-rays' },
        { day: 'Fri, Jun 20', temp: '23°C', tempValue: 23, icon: 'sun-rays' },
        { day: 'Sat, Jun 21', temp: '21°C', tempValue: 21, icon: 'sun-rays' },
        { day: 'Sun, Jun 22', temp: '22°C', tempValue: 22, icon: 'sun-rays' },
        { day: 'Mon, Jun 23', temp: '23°C', tempValue: 23, icon: 'sun-rays' },
      ];

  // UV index with dynamic advice
  const getUVAdvice = (uvi) => {
    if (uvi <= 2) return 'Minimal risk, no protection needed';
    if (uvi <= 5) return 'Apply sunscreen SPF 30+';
    if (uvi <= 7) return 'Wear sunscreen and a hat';
    if (uvi <= 10) return 'Use high SPF sunscreen, hat, and sunglasses';
    return 'Avoid sun exposure, seek shade';
  };

  const uvIndex = weatherData?.current
    ? {
        value: Math.round(weatherData.current.uvi),
        rating: weatherData.current.uvi <= 2 ? 'Low' : weatherData.current.uvi <= 5 ? 'Moderate' : weatherData.current.uvi <= 7 ? 'High' : weatherData.current.uvi <= 10 ? 'Very High' : 'Extreme',
        advice: getUVAdvice(weatherData.current.uvi),
        markerPosition: `${Math.min(weatherData.current.uvi * 20, 180)}px`,
      }
    : {
        value: 6,
        rating: 'Moderate',
        advice: 'Apply sunscreen SPF 30+',
        markerPosition: '180px',
      };


  const wind = weatherData?.current
    ? {
        speed: Math.round(weatherData.current.wind_speed),
        gusts: weatherData.current.wind_gust ? Math.round(weatherData.current.wind_gust) : Math.round(weatherData.current.wind_speed * 1.2),
        unit: 'kph',
      }
    : {
        speed: 10,
        gusts: 12,
        unit: 'kph',
      };

  // Hourly chart data
  const hourlyChartData = {
    labels: hourlyForecast.map((item) => item.time),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: hourlyForecast.map((item) => item.tempValue),
        borderColor: '#00BFFF',
        backgroundColor: 'rgba(0, 191, 255, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // 10-day chart data
  const tenDayChartData = {
    labels: tenDayForecast.map((item) => item.day),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: tenDayForecast.map((item) => item.tempValue),
        borderColor: '#FF4500',
        backgroundColor: 'rgba(255, 69, 0, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        color: '#FFFFFF',
      },
    },
    scales: {
      x: {
        ticks: { color: '#FFFFFF', maxRotation: 45, minRotation: 45 },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        ticks: { color: '#FFFFFF' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        title: { display: true, text: 'Temperature (°C)', color: '#FFFFFF' },
      },
    },
  };

  if (loading) {
    return (
      <div className="weather-dashboard" style={{ backgroundImage: `url(${currentWeather.dashboardBg})` }}>
        <div className="dashboard-container">
          <div className="current-weather">
            <div className="header-bar">
              <div className="location-text">Loading weather...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="weather-dashboard" style={{ backgroundImage: `url(${currentWeather.dashboardBg})` }}>
      <div className="dashboard-container">
        {/* Current Weather */}
        <div className="current-weather">
          <div className="header-bar">
            <div className="location-icon" />
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder={`Current: ${currentWeather.name}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search city"
              />
              <button className="submit-button" onClick={handleSearch}>
                Search
              </button>
              {searchError && <span className="error-text">{searchError}</span>}
            </div>
          </div>
          <div className="main-section" style={{ backgroundImage: `url(${currentWeather.weatherBg})` }}>
            <div className="weather-overlay" />
            <div className="weather-summary">
              <div className="temperature">{currentWeather.temperature}</div>
              <div className="condition">{currentWeather.condition}</div>
            </div>
            <div className="metrics">
              {metrics.map((metric, index) => (
                <div key={index} className="metric-card">
                  <div className={`metric-icon ${metric.icon}-icon`} />
                  <div className="metric-label">{metric.label}</div>
                  <div className="metric-value">{metric.value}</div>
                  <div className="metric-note">{metric.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Forecasts */}
        <div className="forecasts">
          <div className="forecast-container">
            <div className="hourly-forecast">
              <div className="hourly-icon" />
              <div className="forecast-label">Hourly Forecast</div>
              <div className="divider divider-1" />
              <div className="forecast-items-wrapper hourly" ref={hourlyWrapperRef}>
                <div className="forecast-items">
                  {hourlyForecast.map((item, index) => (
                    <div
                      key={index}
                      className={`forecast-item ${selectedHourlyIndex === index ? 'selected' : ''}`}
                      onClick={() => setSelectedHourlyIndex(index)}
                    >
                      <div className="forecast-time">{item.time}</div>
                      <div className="forecast-temp">{item.temp}</div>
                      <div className="forecast-icon hourly-sun-icon" style={{ backgroundImage: `url(${SunRays})` }} />
                    </div>
                  ))}
                </div>
              </div>
              <CustomSlider wrapperRef={hourlyWrapperRef} />
            </div>
            <div className="ten-day-forecast">
              <div className="calendar-icon" />
              <div className="forecast-label">10-Day Forecast</div>
              <div className="divider divider-2" />
              <div className="forecast-items-wrapper ten-day" ref={tenDayWrapperRef}>
                <div className="forecast-items">
                  {tenDayForecast.map((item, index) => (
                    <div
                      key={index}
                      className={`forecast-item ${selectedTenDayIndex === index ? 'selected' : ''}`}
                      onClick={() => setSelectedTenDayIndex(index)}
                    >
                      <div className="forecast-time">{item.day}</div>
                      <div className="forecast-temp">{item.temp}</div>
                      <div className="forecast-icon hourly-sun-icon" style={{ backgroundImage: `url(${SunRays})` }} />
                    </div>
                  ))}
                </div>
              </div>
              <CustomSlider wrapperRef={tenDayWrapperRef} />
            </div>
          </div>

          <div className="charts">
            <div className="hourly-chart">
              <Line
                data={hourlyChartData}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: 'Hourly Temperature' } }}}
              />
            </div>
            <div className="ten-day-chart">
              <Line
                data={tenDayChartData}
                options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: '10-Day Temperature' } }}}
              />
            </div>
          </div>

          <div className="uv-index">
            <div className="uv-icon" />
            <div className="metric-label">UV Index</div>
            <div className="uv-value">{uvIndex.value}</div>
            <div className="uv-rating">{uvIndex.rating}</div>
            <div className="uv-bar">
              <div className="uv-marker" style={{ left: uvIndex.markerPosition }} />
            </div>
            <div className="uv-advice">{uvIndex.advice}</div>
          </div>

          <div className="wind">
            <div className="wind-icon" />
            <div className="metric-label">Wind</div>
            <div className="wind-speed">{wind.speed}</div>
            <div className="wind-unit">{wind.unit}</div>
            <div className="wind-label">{wind.speedLabel}</div>
            <div className="wind-divider" />
            <div className="wind-gusts">{wind.gusts}</div>
            <div className="wind-unit gusts-unit">{wind.unit}</div>
            <div className="wind-label gusts-label">{wind.gustsLabel}</div>
            <div className="wind-compass" />
          </div>
        </div>
      </div>
      {error && (
        <div className="error">
          {error}
          <button
            className="retry-button"
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchWeatherData(location.lat, location.lon);
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

 
  <BrowserRouter basename="/Weather_app">
    <App />
  </BrowserRouter>
export default App;