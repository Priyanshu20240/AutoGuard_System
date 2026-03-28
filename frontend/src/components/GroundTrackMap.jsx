import { useRef, useEffect, useCallback } from 'react'

/**
 * Ground Track Map — Mercator projection world map rendered on Canvas.
 * Shows satellite positions, debris cloud, ground stations, trails,
 * predictions, and the day/night terminator line.
 */

// Simplified world coastline data (lon, lat pairs for major landmasses)
const COASTLINES = [
  // North America
  [[-130,50],[-125,50],[-124,48],[-123,46],[-120,35],[-117,33],[-115,32],[-110,32],[-105,30],[-100,28],[-97,26],[-97,28],[-95,30],[-90,30],[-85,30],[-82,25],[-80,25],[-81,31],[-77,35],[-75,38],[-74,40],[-70,42],[-67,45],[-66,44],[-64,47],[-60,47],[-55,47],[-52,47],[-55,52],[-58,55],[-64,60],[-70,63],[-80,63],[-85,65],[-90,68],[-100,70],[-110,72],[-120,70],[-130,60],[-135,58],[-145,60],[-150,61],[-155,58],[-160,55],[-165,55],[-168,53],[-170,57],[-165,62],[-160,63],[-155,70],[-145,70],[-140,70],[-130,50]],
  // South America
  [[-80,10],[-75,10],[-70,12],[-65,10],[-60,5],[-52,5],[-50,0],[-50,-5],[-45,-5],[-40,-8],[-35,-8],[-35,-12],[-38,-15],[-40,-20],[-42,-23],[-45,-24],[-48,-28],[-50,-30],[-52,-33],[-55,-35],[-57,-38],[-65,-40],[-67,-46],[-65,-52],[-70,-55],[-75,-50],[-75,-45],[-72,-40],[-72,-35],[-70,-30],[-70,-20],[-75,-15],[-77,-12],[-80,-5],[-80,0],[-78,2],[-77,8],[-80,10]],
  // Europe
  [[-10,36],[-5,36],[0,38],[3,43],[0,45],[-5,44],[-10,44],[-10,50],[-5,50],[0,50],[2,51],[5,52],[8,54],[10,55],[12,56],[15,55],[18,55],[20,54],[24,55],[28,56],[30,60],[28,63],[25,65],[20,68],[15,69],[10,63],[5,62],[5,58],[0,55],[-5,55],[-10,52],[-10,36]],
  // Africa
  [[-15,30],[-5,36],[10,37],[12,35],[10,30],[15,30],[20,32],[25,32],[30,30],[33,30],[35,30],[40,12],[42,12],[45,10],[50,12],[50,5],[45,0],[42,-5],[40,-10],[38,-15],[35,-20],[32,-28],[28,-33],[25,-34],[20,-35],[18,-33],[15,-30],[12,-18],[10,-5],[5,5],[0,5],[-5,5],[-10,5],[-15,10],[-18,15],[-17,20],[-15,25],[-15,30]],
  // Asia continent (simplified)
  [[30,35],[35,38],[40,42],[45,40],[50,38],[55,42],[60,40],[65,38],[70,38],[75,35],[80,30],[85,28],[88,22],[90,22],[95,20],[100,22],[105,20],[110,22],[115,25],[120,25],[122,30],[125,35],[130,35],[130,42],[135,40],[140,45],[145,50],[140,55],[135,55],[130,48],[125,45],[120,53],[110,55],[100,55],[90,50],[80,50],[70,55],[60,55],[55,52],[50,55],[40,60],[30,50],[30,35]],
  // Australia
  [[115,-35],[120,-35],[125,-35],[130,-32],[135,-35],[138,-35],[142,-38],[148,-38],[150,-35],[153,-28],[150,-22],[145,-15],[142,-12],[135,-12],[130,-15],[125,-15],[120,-18],[115,-22],[113,-25],[115,-30],[115,-35]],
];

function mercatorX(lon, w) { return ((lon + 180) / 360) * w; }
function mercatorY(lat, h) {
  const latR = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latR / 2));
  return (h / 2) - (h * mercN) / (2 * Math.PI);
}

function drawWrappedPolyline(ctx, points, w, h) {
  if (!points || points.length < 2) return;

  let started = false;
  let prevLon = null;

  for (const [lat, lon] of points) {
    const x = mercatorX(lon, w);
    const y = mercatorY(lat, h);

    if (!started) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      started = true;
      prevLon = lon;
      continue;
    }

    if (prevLon != null && Math.abs(lon - prevLon) > 180) {
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    prevLon = lon;
  }

  ctx.stroke();
}

function shortestWrappedSegment(lonA, lonB, w) {
  const xA = mercatorX(lonA, w);
  const xB = mercatorX(lonB, w);
  const dx = xB - xA;

  if (Math.abs(dx) <= w / 2) {
    return [xA, xB];
  }

  return dx > 0 ? [xA + w, xB] : [xA, xB + w];
}

function getTerminatorPoints(timestamp) {
  // Calculate sub-solar point
  const date = new Date(timestamp);
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const declination = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
  const hourAngle = ((date.getUTCHours() * 60 + date.getUTCMinutes()) / 1440) * 360 - 180;

  const points = [];
  for (let lon = -180; lon <= 180; lon += 2) {
    const lonRad = (lon * Math.PI) / 180;
    const decRad = (declination * Math.PI) / 180;
    const haRad = ((lon - hourAngle) * Math.PI) / 180;
    const terminatorLat = Math.atan(-Math.cos(haRad) / Math.tan(decRad)) * 180 / Math.PI;
    points.push([lon, terminatorLat]);
  }
  return { points, sunLon: hourAngle, sunLat: declination };
}

export default function GroundTrackMap({
  satellites, debrisCloud, groundStations, selectedSat, onSelectSat, warnings
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 0.5;
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = mercatorX(lon, w);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = mercatorY(lat, h);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Equator
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    const eqY = mercatorY(0, h);
    ctx.beginPath(); ctx.moveTo(0, eqY); ctx.lineTo(w, eqY); ctx.stroke();

    // Coastlines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    for (const coast of COASTLINES) {
      ctx.beginPath();
      for (let i = 0; i < coast.length; i++) {
        const x = mercatorX(coast[i][0], w);
        const y = mercatorY(coast[i][1], h);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Fill land
      ctx.fillStyle = 'rgba(56, 189, 248, 0.03)';
      ctx.fill();
    }

    // Day/Night Terminator
    if (satellites.length > 0) {
      try {
        const terminator = getTerminatorPoints(Date.now());
        // Shade the night hemisphere
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'; // Deeper night shadow
        ctx.beginPath();
        const shadeY = terminator.sunLat < 0 ? 0 : h; // If sun is south, north is dark
        ctx.moveTo(0, shadeY);
        for (const [lon, lat] of terminator.points) {
          ctx.lineTo(mercatorX(lon, w), mercatorY(lat, h));
        }
        ctx.lineTo(w, shadeY);
        ctx.closePath();
        ctx.fill();

        // Draw glowing day/night edge
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.3)';
        ctx.lineWidth = 1;
        ctx.shadowColor = 'rgba(250, 204, 21, 0.5)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        for (let i = 0; i < terminator.points.length; i++) {
          const [lon, lat] = terminator.points[i];
          const x = mercatorX(lon, w);
          const y = mercatorY(lat, h);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } catch (e) {}
    }

    // Ground Stations & Coverage
    for (const gs of groundStations) {
      const x = mercatorX(gs.lon, w);
      const y = mercatorY(gs.lat, h);

      // Coverage area bubble (approx 1500km mask)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Station marker
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = 'rgba(250, 204, 21, 0.8)';
      ctx.font = '8px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(gs.name.replace(/_/g, ' '), x, y + 14);
    }

    // Debris cloud (small dots)
    ctx.fillStyle = 'rgba(100, 116, 139, 0.25)';
    for (const deb of debrisCloud) {
      const x = mercatorX(deb[2], w);
      const y = mercatorY(deb[1], h);
      ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
    }

    // Warning lines (satellite to threatening debris)
    for (const warn of warnings) {
      const sat = satellites.find(s => s.id === warn.satellite_id);
      const deb = debrisCloud.find(d => d[0] === warn.debris_id);
      if (sat && deb) {
        const [x1, x2] = shortestWrappedSegment(sat.lon, deb[2], w);
        const y1 = mercatorY(sat.lat, h);
        const y2 = mercatorY(deb[1], h);

        const color = warn.risk_level === 'CRITICAL' ? 'rgba(239,68,68,0.8)' :
                      warn.risk_level === 'RED' ? 'rgba(249,115,22,0.7)' :
                      'rgba(250,204,21,0.5)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        
        // Animated approach vector: flow from debris to satellite
        ctx.lineDashOffset = -(Date.now() / 40); 
        
        ctx.beginPath(); 
        ctx.moveTo(x2, y2);  // Start at Debris
        ctx.lineTo(x1, y1);  // Go to Satellite
        
        // Glow for urgency
        if(warn.risk_level === 'CRITICAL') {
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'rgba(239,68,68,0.8)';
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      }
    }

    // Satellite trails and predictions
    for (const sat of satellites) {
      const isSel = sat.id === selectedSat;

      // Trail (past 90 min) — solid line
      if (sat.trail && sat.trail.length > 1) {
        ctx.strokeStyle = isSel ? 'rgba(56, 189, 248, 0.5)' : 'rgba(74, 222, 128, 0.15)';
        ctx.lineWidth = isSel ? 1.5 : 0.5;
        drawWrappedPolyline(ctx, sat.trail, w, h);
      }

      // Prediction (future 90 min) — dashed line
      if (sat.predictions && sat.predictions.length > 1) {
        ctx.strokeStyle = isSel ? 'rgba(56, 189, 248, 0.3)' : 'rgba(74, 222, 128, 0.08)';
        ctx.lineWidth = isSel ? 1 : 0.3;
        ctx.setLineDash([4, 4]);
        drawWrappedPolyline(ctx, [[sat.lat, sat.lon], ...sat.predictions], w, h);
        ctx.setLineDash([]);
      }
    }

    // Satellite markers
    for (const sat of satellites) {
      const x = mercatorX(sat.lon, w);
      const y = mercatorY(sat.lat, h);
      const isSel = sat.id === selectedSat;
      const size = isSel ? 5 : 3;

      // Color by status
      let color = '#4ade80';
      if (sat.status === 'MANEUVERING') color = '#38bdf8';
      else if (!sat.in_slot || sat.status === 'DRIFTING') color = '#ef4444'; // Red when drifting outside box
      else if (sat.status === 'EOL') color = '#9333ea';

      // Glow for selected
      if (isSel) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }

      // Station-keeping box indicator (nominal position) - showing visual bubble for all
      if (sat.nominal_lat != null) {
        const nx = mercatorX(sat.nominal_lon, w);
        const ny = mercatorY(sat.nominal_lat, h);
        
        ctx.fillStyle = sat.in_slot ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.15)';
        ctx.strokeStyle = sat.in_slot ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(nx, ny, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        if (isSel) {
          // Line from nominal to actual
          ctx.setLineDash([2, 2]);
          ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(x, y); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // LOS indicator
      if (isSel && sat.has_los) {
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;

      // Label for selected
      if (isSel) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 9px JetBrains Mono';
        ctx.textAlign = 'left';
        ctx.fillText(`${sat.id}`, x + 8, y - 4);
        ctx.font = '8px JetBrains Mono';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(`${sat.lat.toFixed(1)}°, ${sat.lon.toFixed(1)}° | ${sat.alt.toFixed(0)} km`, x + 8, y + 6);
        ctx.fillText(`⛽ ${sat.fuel_kg.toFixed(1)} kg | ${sat.status}`, x + 8, y + 16);
      }
    }
  }, [satellites, debrisCloud, groundStations, selectedSat, warnings]);

  useEffect(() => {
    let animFrame;
    const animate = () => {
      draw();
      animFrame = requestAnimationFrame(animate);
    };
    
    // Smooth animation if warnings exist
    if (warnings && warnings.length > 0) {
      animFrame = requestAnimationFrame(animate);
    } else {
      draw();
    }
    
    const observer = new ResizeObserver(draw);
    if (containerRef.current) observer.observe(containerRef.current);
    
    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      observer.disconnect();
    };
  }, [draw]);

  // Handle click to select satellite
  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    let closest = null;
    let minDist = 20;
    for (const sat of satellites) {
      const sx = mercatorX(sat.lon, w);
      const sy = mercatorY(sat.lat, h);
      const d = Math.sqrt((cx - sx) ** 2 + (cy - sy) ** 2);
      if (d < minDist) { minDist = d; closest = sat.id; }
    }
    if (closest) onSelectSat(closest);
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        className="ground-track-canvas"
        onClick={handleClick}
        style={{ cursor: 'crosshair' }}
      />
    </div>
  );
}
