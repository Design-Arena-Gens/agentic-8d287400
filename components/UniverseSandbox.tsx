'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'

interface CelestialBody {
  id: string
  name: string
  position: THREE.Vector3
  velocity: THREE.Vector3
  mass: number
  radius: number
  color: string
  type: 'star' | 'planet' | 'moon' | 'asteroid'
  trail: THREE.Vector3[]
}

const G = 6.67430e-11 // Gravitational constant (scaled for simulation)
const SCALE = 1e-9 // Scale factor for distances
const TIME_SCALE = 60 * 60 * 24 // 1 frame = 1 day

function TrailLine({ points, color }: { points: THREE.Vector3[]; color: string }) {
  const ref = useRef<THREE.Line>(null)

  useEffect(() => {
    if (ref.current && points.length > 1) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      ref.current.geometry.dispose()
      ref.current.geometry = geometry
    }
  }, [points])

  if (points.length < 2) return null

  return (
    <primitive object={new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color, opacity: 0.6, transparent: true })
    )} />
  )
}

function CelestialBodyMesh({ body, showTrails }: { body: CelestialBody; showTrails: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(body.position)
    }
  }, [body.position])

  const emissiveIntensity = body.type === 'star' ? 2 : 0

  return (
    <>
      <mesh ref={meshRef} position={body.position}>
        <sphereGeometry args={[body.radius, 32, 32]} />
        <meshStandardMaterial
          color={body.color}
          emissive={body.color}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      {showTrails && body.trail.length > 1 && (
        <TrailLine points={body.trail} color={body.color} />
      )}
    </>
  )
}

function Scene({
  bodies,
  setBodies,
  paused,
  timeScale,
  showTrails,
  collisionsEnabled,
}: {
  bodies: CelestialBody[]
  setBodies: React.Dispatch<React.SetStateAction<CelestialBody[]>>
  paused: boolean
  timeScale: number
  showTrails: boolean
  collisionsEnabled: boolean
}) {
  const { camera } = useThree()

  useFrame(() => {
    if (paused) return

    setBodies((prevBodies) => {
      const newBodies = prevBodies.map((body) => ({
        ...body,
        position: body.position.clone(),
        velocity: body.velocity.clone(),
        trail: [...body.trail],
      }))

      // Calculate gravitational forces
      for (let i = 0; i < newBodies.length; i++) {
        const bodyA = newBodies[i]
        const force = new THREE.Vector3()

        for (let j = 0; j < newBodies.length; j++) {
          if (i === j) continue
          const bodyB = newBodies[j]

          const direction = new THREE.Vector3().subVectors(bodyB.position, bodyA.position)
          const distance = direction.length()

          if (distance < bodyA.radius + bodyB.radius && collisionsEnabled) {
            // Collision detected - merge bodies
            const totalMass = bodyA.mass + bodyB.mass
            const newVelocity = new THREE.Vector3()
              .addScaledVector(bodyA.velocity, bodyA.mass / totalMass)
              .addScaledVector(bodyB.velocity, bodyB.mass / totalMass)

            bodyA.mass = totalMass
            bodyA.radius = Math.cbrt(Math.pow(bodyA.radius, 3) + Math.pow(bodyB.radius, 3))
            bodyA.velocity.copy(newVelocity)
            newBodies.splice(j, 1)
            if (j < i) i--
            continue
          }

          if (distance > 0) {
            const forceMagnitude = (G * bodyA.mass * bodyB.mass) / (distance * distance)
            force.add(direction.normalize().multiplyScalar(forceMagnitude))
          }
        }

        // Update velocity and position
        const acceleration = force.divideScalar(bodyA.mass)
        bodyA.velocity.add(acceleration.multiplyScalar(TIME_SCALE * timeScale))
        bodyA.position.add(
          new THREE.Vector3().copy(bodyA.velocity).multiplyScalar(TIME_SCALE * timeScale * SCALE)
        )

        // Update trail
        if (bodyA.trail.length === 0 || bodyA.position.distanceTo(bodyA.trail[bodyA.trail.length - 1]) > 1) {
          bodyA.trail.push(bodyA.position.clone())
          if (bodyA.trail.length > 1000) bodyA.trail.shift()
        }
      }

      return newBodies
    })
  })

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={2} />
      <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        zoomSpeed={1.5}
        panSpeed={1}
        rotateSpeed={0.5}
      />
      {bodies.map((body) => (
        <CelestialBodyMesh key={body.id} body={body} showTrails={showTrails} />
      ))}
    </>
  )
}

export default function UniverseSandbox() {
  const [bodies, setBodies] = useState<CelestialBody[]>([])
  const [paused, setPaused] = useState(false)
  const [timeScale, setTimeScale] = useState(1)
  const [showTrails, setShowTrails] = useState(true)
  const [collisionsEnabled, setCollisionsEnabled] = useState(true)
  const [selectedPreset, setSelectedPreset] = useState('solar-system')

  // Body creation parameters
  const [newBodyMass, setNewBodyMass] = useState(5.972e24) // Earth mass
  const [newBodyRadius, setNewBodyRadius] = useState(10)
  const [newBodyType, setNewBodyType] = useState<'star' | 'planet' | 'moon' | 'asteroid'>('planet')

  const initializeSolarSystem = useCallback(() => {
    const sun: CelestialBody = {
      id: 'sun',
      name: 'Sun',
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 1.989e30,
      radius: 20,
      color: '#FDB813',
      type: 'star',
      trail: [],
    }

    const earth: CelestialBody = {
      id: 'earth',
      name: 'Earth',
      position: new THREE.Vector3(150, 0, 0),
      velocity: new THREE.Vector3(0, 0, 29.78e3),
      mass: 5.972e24,
      radius: 8,
      color: '#4A90E2',
      type: 'planet',
      trail: [],
    }

    const mars: CelestialBody = {
      id: 'mars',
      name: 'Mars',
      position: new THREE.Vector3(228, 0, 0),
      velocity: new THREE.Vector3(0, 0, 24.07e3),
      mass: 6.39e23,
      radius: 5,
      color: '#E27B58',
      type: 'planet',
      trail: [],
    }

    const venus: CelestialBody = {
      id: 'venus',
      name: 'Venus',
      position: new THREE.Vector3(108, 0, 0),
      velocity: new THREE.Vector3(0, 0, 35.02e3),
      mass: 4.867e24,
      radius: 7,
      color: '#FFC649',
      type: 'planet',
      trail: [],
    }

    const jupiter: CelestialBody = {
      id: 'jupiter',
      name: 'Jupiter',
      position: new THREE.Vector3(380, 0, 0),
      velocity: new THREE.Vector3(0, 0, 13.07e3),
      mass: 1.898e27,
      radius: 15,
      color: '#C88B3A',
      type: 'planet',
      trail: [],
    }

    setBodies([sun, earth, mars, venus, jupiter])
  }, [])

  const initializeBinaryStars = useCallback(() => {
    const star1: CelestialBody = {
      id: 'star1',
      name: 'Star 1',
      position: new THREE.Vector3(-100, 0, 0),
      velocity: new THREE.Vector3(0, 0, 15e3),
      mass: 1.5e30,
      radius: 18,
      color: '#FDB813',
      type: 'star',
      trail: [],
    }

    const star2: CelestialBody = {
      id: 'star2',
      name: 'Star 2',
      position: new THREE.Vector3(100, 0, 0),
      velocity: new THREE.Vector3(0, 0, -15e3),
      mass: 1.2e30,
      radius: 16,
      color: '#FF6B6B',
      type: 'star',
      trail: [],
    }

    const planet: CelestialBody = {
      id: 'planet',
      name: 'Planet',
      position: new THREE.Vector3(0, 150, 0),
      velocity: new THREE.Vector3(25e3, 0, 0),
      mass: 5.972e24,
      radius: 8,
      color: '#4A90E2',
      type: 'planet',
      trail: [],
    }

    setBodies([star1, star2, planet])
  }, [])

  const initializeThreeBodyProblem = useCallback(() => {
    const body1: CelestialBody = {
      id: 'body1',
      name: 'Body 1',
      position: new THREE.Vector3(-100, 0, 0),
      velocity: new THREE.Vector3(0, 15e3, 10e3),
      mass: 1e30,
      radius: 15,
      color: '#FDB813',
      type: 'star',
      trail: [],
    }

    const body2: CelestialBody = {
      id: 'body2',
      name: 'Body 2',
      position: new THREE.Vector3(100, 0, 0),
      velocity: new THREE.Vector3(0, -15e3, -5e3),
      mass: 1e30,
      radius: 15,
      color: '#4A90E2',
      type: 'star',
      trail: [],
    }

    const body3: CelestialBody = {
      id: 'body3',
      name: 'Body 3',
      position: new THREE.Vector3(0, 150, 0),
      velocity: new THREE.Vector3(-20e3, 0, -5e3),
      mass: 1e30,
      radius: 15,
      color: '#E27B58',
      type: 'star',
      trail: [],
    }

    setBodies([body1, body2, body3])
  }, [])

  useEffect(() => {
    initializeSolarSystem()
  }, [initializeSolarSystem])

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset)
    switch (preset) {
      case 'solar-system':
        initializeSolarSystem()
        break
      case 'binary-stars':
        initializeBinaryStars()
        break
      case 'three-body':
        initializeThreeBodyProblem()
        break
      case 'empty':
        setBodies([])
        break
    }
  }

  const addRandomBody = () => {
    const angle = Math.random() * Math.PI * 2
    const distance = 100 + Math.random() * 200
    const speed = Math.sqrt((G * 1.989e30) / (distance * 1e9)) // Orbital speed

    const typeColors = {
      star: '#FDB813',
      planet: '#4A90E2',
      moon: '#AAAAAA',
      asteroid: '#8B7355',
    }

    const newBody: CelestialBody = {
      id: `body-${Date.now()}-${Math.random()}`,
      name: `${newBodyType} ${bodies.length + 1}`,
      position: new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance),
      velocity: new THREE.Vector3(-Math.sin(angle) * speed, 0, Math.cos(angle) * speed),
      mass: newBodyMass,
      radius: newBodyRadius,
      color: typeColors[newBodyType],
      type: newBodyType,
      trail: [],
    }

    setBodies([...bodies, newBody])
  }

  const clearAllBodies = () => {
    setBodies([])
  }

  const resetTrails = () => {
    setBodies((prevBodies) =>
      prevBodies.map((body) => ({
        ...body,
        trail: [],
      }))
    )
  }

  return (
    <>
      <Canvas camera={{ position: [0, 200, 400], fov: 60 }}>
        <Scene
          bodies={bodies}
          setBodies={setBodies}
          paused={paused}
          timeScale={timeScale}
          showTrails={showTrails}
          collisionsEnabled={collisionsEnabled}
        />
      </Canvas>

      <div className="ui-overlay">
        <div className="control-panel">
          <h2>Universe Sandbox</h2>

          <div className="control-group">
            <label>Preset Scenarios</label>
            <select value={selectedPreset} onChange={(e) => handlePresetChange(e.target.value)}>
              <option value="solar-system">Solar System</option>
              <option value="binary-stars">Binary Stars</option>
              <option value="three-body">Three Body Problem</option>
              <option value="empty">Empty Space</option>
            </select>
          </div>

          <div className="control-group">
            <label>
              Time Scale <span className="value-display">{timeScale.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={timeScale}
              onChange={(e) => setTimeScale(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <button onClick={() => setPaused(!paused)}>
              {paused ? '▶ Resume' : '⏸ Pause'}
            </button>
          </div>

          <div className="control-group checkbox-group">
            <input
              type="checkbox"
              id="trails"
              checked={showTrails}
              onChange={(e) => setShowTrails(e.target.checked)}
            />
            <label htmlFor="trails">Show Orbital Trails</label>
          </div>

          <div className="control-group checkbox-group">
            <input
              type="checkbox"
              id="collisions"
              checked={collisionsEnabled}
              onChange={(e) => setCollisionsEnabled(e.target.checked)}
            />
            <label htmlFor="collisions">Enable Collisions</label>
          </div>

          <div className="control-group">
            <button onClick={resetTrails}>Clear Trails</button>
          </div>

          <div className="control-group">
            <label>Add Custom Body</label>
            <select value={newBodyType} onChange={(e) => setNewBodyType(e.target.value as any)}>
              <option value="star">Star</option>
              <option value="planet">Planet</option>
              <option value="moon">Moon</option>
              <option value="asteroid">Asteroid</option>
            </select>
          </div>

          <div className="control-group">
            <label>Mass (kg)</label>
            <input
              type="number"
              value={newBodyMass}
              onChange={(e) => setNewBodyMass(parseFloat(e.target.value))}
              step="1e23"
            />
          </div>

          <div className="control-group">
            <label>Radius</label>
            <input
              type="number"
              value={newBodyRadius}
              onChange={(e) => setNewBodyRadius(parseFloat(e.target.value))}
              min="1"
              max="50"
            />
          </div>

          <div className="control-group">
            <button onClick={addRandomBody}>Add Body</button>
          </div>

          <div className="control-group">
            <button className="danger" onClick={clearAllBodies}>
              Clear All Bodies
            </button>
          </div>
        </div>

        <div className="info-panel">
          <h3>Simulation Info</h3>
          <div className="info-item">
            <span className="info-label">Bodies:</span>
            <span>{bodies.length}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Status:</span>
            <span>{paused ? 'Paused' : 'Running'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Time Scale:</span>
            <span>{timeScale.toFixed(1)}x</span>
          </div>
          <div className="info-item">
            <span className="info-label">Physics:</span>
            <span>Newtonian Gravity</span>
          </div>
        </div>

        <div className="instructions">
          <h3>Controls</h3>
          <ul>
            <li>🖱️ Left Click + Drag: Rotate view</li>
            <li>🖱️ Right Click + Drag: Pan camera</li>
            <li>🖱️ Scroll: Zoom in/out</li>
            <li>⏸️ Space: Pause/Resume</li>
            <li>🌍 Add bodies with custom parameters</li>
            <li>💥 Watch collisions merge objects</li>
          </ul>
        </div>
      </div>
    </>
  )
}
