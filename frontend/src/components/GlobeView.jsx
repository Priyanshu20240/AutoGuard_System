import { useRef, useEffect, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';

const EARTH_RADIUS_KM = 6378.137;

function toGlobeAltitude(altKm, minimum = 0.01, exaggeration = 1.0) {
  if (typeof altKm !== 'number') return minimum;
  return minimum + (altKm / EARTH_RADIUS_KM) * exaggeration;
}

export default function GlobeView({ satellites, debrisCloud, groundStations, selectedSat, onSelectSat, warnings }) {
  const globeRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef();

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!globeRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    globeRef.current.pointOfView({ lat: 22, lng: 24, altitude: 2.15 }, 0);

    const controls = globeRef.current.controls();
    if (!controls) return;

    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.38;
    controls.minDistance = 180;
    controls.maxDistance = 360;
  }, [dimensions]);

  // Format data for Globe mapping
  const satData = satellites.map(sat => ({
    lat: sat.lat,
    lng: sat.lon,
    alt: toGlobeAltitude(sat.alt, 0.035, 1.85),
    radius: sat.id === selectedSat ? 3.2 : 2.0,
    color: sat.status === 'EOL' ? '#9333ea' :
      (!sat.in_slot || sat.status === 'DRIFTING') ? '#ef4444' :
      sat.status === 'MANEUVERING' ? '#38bdf8' : '#4ade80',
    id: sat.id,
    type: 'sat'
  }));

  const gsData = groundStations.map(gs => ({
    lat: gs.lat,
    lng: gs.lon,
    alt: 0.01,
    size: 1.0,
    color: '#facc15',
    name: gs.name,
    type: 'gs'
  }));

  const debrisData = debrisCloud.map(deb => ({
    lat: deb[1],
    lng: deb[2],
    alt: toGlobeAltitude(deb[3], 0.024, 1.65),
    radius: 0.5,
    color: '#cbd5e1',
    id: deb[0],
    type: 'deb'
  }));

  const orbitalObjects = [...satData, ...debrisData];

  const sharedGeometry = useMemo(() => ({
    satellite: new THREE.SphereGeometry(1, 18, 18),
    debris: new THREE.SphereGeometry(1, 10, 10),
  }), []);

  useEffect(() => () => {
    sharedGeometry.satellite.dispose();
    sharedGeometry.debris.dispose();
  }, [sharedGeometry]);

  const buildOrbitalObject = (obj) => {
    const geometry = obj.type === 'sat' ? sharedGeometry.satellite : sharedGeometry.debris;
    const material = new THREE.MeshLambertMaterial({
      color: obj.color,
      transparent: obj.type === 'deb',
      opacity: obj.type === 'deb' ? 0.72 : 1,
      emissive: new THREE.Color(obj.color),
      emissiveIntensity: obj.type === 'sat' ? 0.42 : 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(obj.radius);
    return mesh;
  };

  // Create threatening arcs based on warnings
  const arcsData = warnings.map(warn => {
    const sat = satellites.find(s => s.id === warn.satellite_id);
    const deb = debrisCloud.find(d => d[0] === warn.debris_id);
    if (!sat || !deb) return null;
    return {
      startLat: deb[1],
      startLng: deb[2],
      endLat: sat.lat,
      endLng: sat.lon,
      color: warn.risk_level === 'CRITICAL' ? '#ef4444' : '#f97316'
    };
  }).filter(Boolean);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {dimensions.width > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere
          atmosphereColor="#3b82f6"
          atmosphereAltitude={0.14}
          
          // Keep ground stations on the default point layer.
          pointsData={gsData}
          pointLat="lat"
          pointLng="lng"
          pointAltitude="alt"
          pointColor="color"
          pointRadius="size"
          pointResolution={16}
          pointLabel={d => d.id || d.name}

          // Satellites and debris as spherical orbital markers instead of bars.
          objectsData={orbitalObjects}
          objectLat="lat"
          objectLng="lng"
          objectAltitude="alt"
          objectFacesSurface={false}
          objectThreeObject={buildOrbitalObject}
          objectLabel={obj => obj.id}
          onObjectClick={obj => {
            if (obj.type === 'sat') onSelectSat(obj.id);
          }}

          // Arcs for CDM threats
          arcsData={arcsData}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcDashLength={0.5}
          arcDashGap={1}
          arcDashInitialGap={() => Math.random()}
          arcDashAnimateTime={2000}
        />
      )}
    </div>
  );
}
