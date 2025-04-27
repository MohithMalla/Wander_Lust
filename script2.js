const MAPTILER_API_KEY = 'ScHd778QMlb8vwrBdStf'; // Your MapTiler API key

// Get the location from the EJS template
const locationName = location; // Get the location from the server-side EJS as a string

console.log("Location:", locationName); // Check if locationName is correct

// Initialize the map
const map = new maplibregl.Map({
  container: 'map',
  style: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_API_KEY}`,
  center: [77.5946, 12.9716], // Default center
  zoom: 4
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

let marker = null; // For placing marker

// Function to add a circle with a radius of 5000 meters around the marker
function addCircleAroundMarker(coords) {
  const initialRadiusInMeters = 5000;

  // Remove existing circle layer and source if they exist
  if (map.getLayer('circle-layer')) {
    map.removeLayer('circle-layer');
  }
  if (map.getSource('circle')) {
    map.removeSource('circle');
  }

  map.addSource('circle', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coords
      }
    }
  });

  map.addLayer({
    id: 'circle-layer',
    type: 'circle',
    source: 'circle',
    paint: {
      'circle-radius': getCircleRadius(map.getZoom()) / 100, // Initial circle size
      'circle-color': 'rgba(255, 0, 0, 0.2)', // Light red color
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(255, 0, 0, 1)' // Red border for circle
    }
  });
}

// Function to calculate circle radius based on zoom level
function getCircleRadius(zoomLevel) {
  const baseRadius = 5000;
  const scaleFactor = 1 + (zoomLevel - 12) * 0.5; // Adjust scale factor for zoom
  return baseRadius * scaleFactor;
}

// Listen for zoom events and update circle radius
map.on('zoom', function() {
  // Check if the layer exists before trying to set its paint property
  if (map.getLayer('circle-layer')) {
    const radius = getCircleRadius(map.getZoom()) / 100;
    map.setPaintProperty('circle-layer', 'circle-radius', radius);
  }
});

// Geocode and place marker function
async function geocodeLocation(locationName) {
  try {
    const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(locationName)}.json?key=${MAPTILER_API_KEY}`);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const coords = data.features[0].geometry.coordinates;

      // Remove existing marker if any
      if (marker) {
        marker.remove();
      }

      // Add a new marker
      marker = new maplibregl.Marker({ color: 'red' })
        .setLngLat(coords)
        .setPopup(new maplibregl.Popup().setHTML(`<h3>${locationName}</h3><p>Location found!</p>`))
        .addTo(map);

      // Fly to the new location
      map.flyTo({ center: coords, zoom: 14 });

      // Add a circle around the marker with a radius of 5000 meters
      addCircleAroundMarker(coords);

    } else {
      alert("Location not found! Check listing location.");
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    alert("Error fetching location!");
  }
}

// Auto call geocode when page loads
map.on('load', () => { // Ensure map is loaded before geocoding
  if (locationName) {
    geocodeLocation(locationName); // Call the geocode function to get the coordinates
  } else {
    alert("No location found in listing.");
  }
});