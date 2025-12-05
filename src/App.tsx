// @ts-nocheck
import { useState, useMemo, useRef, useEffect, Suspense, useCallback } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  PerspectiveCamera,
  shaderMaterial,
  Stars,
  Sparkles,
  useTexture,
  Text,
  Text3D,
  DeviceOrientationControls
} from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import * as random from 'maath/random';
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

// --- ⚠️ 关键配置: 资源路径前缀 ---
// 如果你的文件夹叫 tree，这里就保留 '/tree'。
// 如果你以后要把文件夹改成 christmas，就把这里改成 '/christmas'。
const BASE_PATH = ''; 

// 辅助函数：自动给路径加上前缀
const p = (path) => `${BASE_PATH}${path}`;

// --- 静态数据: 智能循环生成图片路径 ---
const TOTAL_REQUIRED_SLOTS = 44; 
const EXISTING_PHOTOS_COUNT = 31; 
const bodyPhotoPaths = [
  p('/photos/top.jpg'), 
  ...Array.from({ length: TOTAL_REQUIRED_SLOTS }, (_, i) => p(`/photos/${(i % EXISTING_PHOTOS_COUNT) + 1}.jpg`))
];

// --- 🎨 主题配置 ---
const THEMES = {
  CLASSIC: { name: "经典圣诞", foliage: '#004225', light: '#FFD54F', bg: '#000500' },
  FROZEN:  { name: "冰雪奇缘",  foliage: '#A5D6A7', light: '#E0F7FA', bg: '#001133' },
  CYBER:   { name: "赛博朋克",   foliage: '#FF00FF', light: '#00FFFF', bg: '#110022' }
};

// --- Shader Material ---
const FoliageMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color(THEMES.CLASSIC.foliage), uProgress: 0 },
  `uniform float uTime; uniform float uProgress; attribute vec3 aTargetPos; attribute float aRandom;
  varying vec2 vUv; varying float vMix;
  float cubicInOut(float t) { return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0; }
  void main() {
    vUv = uv;
    vec3 noise = vec3(sin(uTime * 1.5 + position.x), cos(uTime + position.y), sin(uTime * 1.5 + position.z)) * 0.15;
    float t = cubicInOut(uProgress);
    vec3 finalPos = mix(position, aTargetPos + noise, t);
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_PointSize = (60.0 * (1.0 + aRandom)) / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    vMix = t;
  }`,
  `uniform vec3 uColor; varying float vMix;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5)); if (r > 0.5) discard;
    vec3 finalColor = mix(uColor * 0.3, uColor * 1.2, vMix);
    gl_FragColor = vec4(finalColor, 1.0);
  }`
);
extend({ FoliageMaterial });

// --- 🎵 音频管理器 (路径已修复) ---
const AudioManager = ({ playRef }) => {
  // 使用 p() 函数包裹路径
  const bgm = useRef(typeof Audio !== "undefined" ? new Audio(p('/sounds/bgm.mp3')) : null);
  const ding = useRef(typeof Audio !== "undefined" ? new Audio(p('/sounds/ding.mp3')) : null);
  const swoosh = useRef(typeof Audio !== "undefined" ? new Audio(p('/sounds/swoosh.mp3')) : null);

  useEffect(() => {
    if (bgm.current) { bgm.current.loop = true; bgm.current.volume = 0.4; }
    playRef.current = {
      playBgm: () => bgm.current?.play().catch(() => {}),
      pauseBgm: () => bgm.current?.pause(),
      playDing: () => { if(ding.current) { ding.current.currentTime=0; ding.current.play().catch(()=>{}); } },
      playSwoosh: () => { if(swoosh.current) { swoosh.current.currentTime=0; swoosh.current.play().catch(()=>{}); } }
    };
  }, []);
  return null;
};

// --- ❄️ 飘雪效果 (路径已修复) ---
const Snow = () => {
  const tex = useTexture(p('/textures/snowflake.png')); // 修复路径
  const count = 1000;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
      pos[i*3] = (Math.random()-0.5) * 100;
      pos[i*3+1] = Math.random() * 60;
      pos[i*3+2] = (Math.random()-0.5) * 100;
    }
    return pos;
  }, []);
   
  const ref = useRef();
  useFrame((_, delta) => {
    if(!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array;
    for(let i=0; i<count; i++) {
        pos[i*3+1] -= delta * 5; 
        if(pos[i*3+1] < -30) pos[i*3+1] = 60; 
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.rotation.y += delta * 0.1;
  });

  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial map={tex} size={0.8} transparent opacity={0.8} depthWrite={false} color="#ffffff" />
    </points>
  );
};

// --- ✨ 烟花特效 ---
const Fireworks = ({ active }) => {
  if (!active) return null;
  return (
    <group position={[0, 20, -20]}>
       <Sparkles count={500} scale={30} size={20} speed={2} opacity={1} color="#FFD700" />
       <pointLight intensity={50} distance={50} color="orange" />
    </group>
  );
};

// --- ⏳ 3D 倒计时牌 (字体路径已修复) ---
const CountdownBoard = () => {
  const [daysLeft, setDaysLeft] = useState(0);
  useEffect(() => {
    const target = new Date(new Date().getFullYear() + 1, 0, 1); 
    const timer = setInterval(() => {
      const now = new Date();
      setDaysLeft(Math.floor((target - now) / (1000 * 60 * 60 * 24)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <group position={[12, -8, 10]} rotation={[0, -0.5, 0]}>
      {/* 修复字体路径 */}
      <Text3D font={p("/fonts/helvetiker_regular.typeface.json")} size={2} height={0.2} curveSegments={12}>
        {daysLeft} DAYS<meshStandardMaterial color="#FFD700" emissive="#FF4400" />
      </Text3D>
      <Text3D font={p("/fonts/helvetiker_regular.typeface.json")} size={0.8} height={0.1} position={[0, -1.5, 0]}>
        TO 2026<meshStandardMaterial color="#ffffff" />
      </Text3D>
    </group>
  );
};

// --- 树叶组件 ---
const Foliage = ({ state, currentTheme }) => {
  const materialRef = useRef(null);
  const { positions, targetPositions, randoms } = useMemo(() => {
    const count = 3500;
    const positions = new Float32Array(count * 3); const targetPositions = new Float32Array(count * 3); const randoms = new Float32Array(count);
    const spherePoints = random.inSphere(new Float32Array(count * 3), { radius: 25 });
    const getTreePosition = () => {
        const h = 22; const rBase = 9;
        const y = (Math.random() * h) - (h / 2); const normalizedY = (y + (h/2)) / h;
        const currentRadius = rBase * (1 - normalizedY); const theta = Math.random() * Math.PI * 2;
        const r = Math.random() * currentRadius;
        return [r * Math.cos(theta), y, r * Math.sin(theta)];
    };
    for (let i = 0; i < count; i++) {
      positions[i*3] = spherePoints[i*3]; positions[i*3+1] = spherePoints[i*3+1]; positions[i*3+2] = spherePoints[i*3+2];
      const [tx, ty, tz] = getTreePosition();
      targetPositions[i*3] = tx; targetPositions[i*3+1] = ty; targetPositions[i*3+2] = tz;
      randoms[i] = Math.random();
    }
    return { positions, targetPositions, randoms };
  }, []);

  useFrame((rootState, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime = rootState.clock.elapsedTime;
      materialRef.current.uProgress = MathUtils.damp(materialRef.current.uProgress, state === 'FORMED' ? 1 : 0, 1.5, delta);
      materialRef.current.uColor.lerp(new THREE.Color(currentTheme.foliage), delta * 2);
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aTargetPos" args={[targetPositions, 3]} />
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
      </bufferGeometry>
      {/* @ts-ignore */}
      <foliageMaterial ref={materialRef} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

// --- 照片挂件 ---
const PhotoOrnaments = ({ state }) => {
  const textures = useTexture(bodyPhotoPaths);
  const count = 200;
  const groupRef = useRef(null);
  const borderGeometry = useMemo(() => new THREE.PlaneGeometry(1.2, 1.5), []);
  const photoGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const h = 22; const y = (Math.random() * h) - (h / 2);
      const rBase = 9; const currentRadius = (rBase * (1 - (y + (h/2)) / h)) + 0.5;
      const theta = Math.random() * Math.PI * 2;
      return {
        targetPos: new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta)),
        chaosPos: new THREE.Vector3((Math.random()-0.5)*70, (Math.random()-0.5)*70, (Math.random()-0.5)*70),
        textureIndex: i % textures.length,
        windOffset: Math.random() * 100,
        speed: 0.5 + Math.random(),
        rotationSpeed: { x: (Math.random()-0.5), y: (Math.random()-0.5) }
      };
    });
  }, [textures]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const time = stateObj.clock.elapsedTime;
    const isFormed = state === 'FORMED';

    groupRef.current.children.forEach((group, i) => {
      const d = data[i];
      const target = isFormed ? d.targetPos : d.chaosPos;
      group.position.lerp(target, delta * 0.8);

      if (isFormed) {
          const windX = Math.sin(time * d.speed + d.windOffset) * 0.2;
          const windZ = Math.cos(time * d.speed * 0.5 + d.windOffset) * 0.1;
          group.lookAt(0, group.position.y, 0); 
          group.rotation.x += windX; 
          group.rotation.z += windZ;
      } else {
          group.rotation.x += delta * d.rotationSpeed.x;
          group.rotation.y += delta * d.rotationSpeed.y;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((d, i) => (
        <group key={i}>
          <mesh geometry={photoGeometry} position={[0,0,0.01]}><meshStandardMaterial map={textures[d.textureIndex]} roughness={0.5} /></mesh>
          <mesh geometry={borderGeometry} position={[0,-0.15,0]}><meshStandardMaterial color="#FFFAF0" /></mesh>
        </group>
      ))}
    </group>
  );
};

// --- 飞出的画廊 ---
const FlyingFrames = ({ activeGallery }) => {
  const textures = useTexture(bodyPhotoPaths);
  const groupRef = useRef(null);
  const ringRotation = useRef(0);
  const frameGeo = useMemo(() => new THREE.PlaneGeometry(5.5, 6.8), []);
  const photoGeo = useMemo(() => new THREE.PlaneGeometry(4.8, 4.8), []);

  const displayIndices = useMemo(() => {
    if (!activeGallery) return [];
    if (activeGallery === 'TOP') return [0];
    const start = (activeGallery - 1) * 11 + 1;
    const end = start + 11;
    const indices = [];
    for(let i = start; i < end; i++) { if(i < textures.length) indices.push(i); }
    return indices;
  }, [activeGallery, textures.length]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const camera = state.camera;
    const angleToCamera = Math.atan2(camera.position.x, camera.position.z);
    groupRef.current.rotation.y = angleToCamera;

    if (activeGallery) { ringRotation.current += delta * 0.4; } 
    else { ringRotation.current -= delta * 1.5; }

    const total = displayIndices.length;
    const angleStep = (Math.PI * 2) / (total || 1);

    groupRef.current.children.forEach((child, i) => {
        let targetPos = new THREE.Vector3(0, 0, 0);
        let targetScale = 0; 
        child.lookAt(camera.position);
        if (activeGallery) {
            const currentAngle = i * angleStep + ringRotation.current;
            targetPos.set(Math.sin(currentAngle) * 22, 12 + Math.cos(currentAngle * 2) * 1.5, Math.cos(currentAngle) * 22);
            targetScale = 1; 
        } else {
            targetPos.set(0, 25, 0); targetScale = 0;
        }
        child.position.lerp(targetPos, delta * 0.8);
        child.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 0.8);
    });
  });

  return (
    <group ref={groupRef}>
      {displayIndices.map((texIndex, i) => (
         <group key={`fly-${texIndex}`}>
             <pointLight color="#ffffff" intensity={50} distance={10} position={[0, -2.5, 3]} decay={2} />
             <mesh geometry={photoGeo} position={[0, 0.4, 0.15]}><meshStandardMaterial map={textures[texIndex]} roughness={0.6} metalness={0.1} /></mesh>
             <mesh geometry={frameGeo} position={[0, 0, 0]}><meshStandardMaterial color="#FFFAF0" roughness={0.8} /></mesh>
             <Text position={[0, -3.0, 0.16]} fontSize={0.6} color="gold">Memory #{texIndex}</Text>
         </group>
      ))}
    </group>
  );
};

// --- 圣诞元素 ---
const ChristmasElements = ({ state }) => {
  const count = 80;
  const groupRef = useRef(null);
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(0.8, 0.8, 0.8), []);
  const data = useMemo(() => new Array(count).fill(0).map(() => ({
     pos: new THREE.Vector3((Math.random()-0.5)*60, (Math.random()-0.5)*60, (Math.random()-0.5)*60),
     target: new THREE.Vector3().setFromCylindricalCoords(Math.random()*8, Math.random()*20-10, Math.random()*Math.PI*2),
     color: Math.random() > 0.5 ? '#D32F2F' : '#FFD700',
     scale: 0.5 + Math.random()*0.5
  })), []);
  useFrame((_, delta) => {
      if(!groupRef.current) return;
      groupRef.current.children.forEach((mesh, i) => {
          const d = data[i];
          const dest = state === 'FORMED' ? d.target : d.pos;
          mesh.position.lerp(dest, delta);
          mesh.rotation.x += delta;
      });
  });
  return <group ref={groupRef}>{data.map((d, i) => <mesh key={i} geometry={boxGeometry} scale={d.scale} position={d.pos}><meshStandardMaterial color={d.color} /></mesh>)}</group>;
};

const FairyLights = ({ state }) => {
  const count = 150;
  const groupRef = useRef(null);
  const geo = useMemo(() => new THREE.SphereGeometry(0.2, 8, 8), []);
  const data = useMemo(() => new Array(count).fill(0).map(() => ({
      pos: new THREE.Vector3().randomDirection().multiplyScalar(30),
      target: new THREE.Vector3().setFromCylindricalCoords(9 * Math.random(), Math.random()*22-11, Math.random()*Math.PI*2),
      color: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'][Math.floor(Math.random() * 4)],
      speed: Math.random()
  })), []);
  useFrame(({ clock }, delta) => {
      if(!groupRef.current) return;
      const t = clock.elapsedTime;
      groupRef.current.children.forEach((mesh, i) => {
          const d = data[i];
          mesh.position.lerp(state === 'FORMED' ? d.target : d.pos, delta * 2);
          const intensity = Math.sin(t * 3 + d.speed * 10) > 0 ? 2 : 0.5;
          if(mesh.material) mesh.material.emissiveIntensity = intensity;
      });
  });
  return <group ref={groupRef}>{data.map((d, i) => <mesh key={i} geometry={geo}><meshStandardMaterial color={d.color} emissive={d.color} /></mesh>)}</group>;
};

const TopStar = ({ state }) => {
  const groupRef = useRef(null);
  const starShape = useMemo(() => {
    const shape = new THREE.Shape(); const outer=1.3; const inner=0.7; 
    for(let i=0; i<10; i++) {
        const r = i%2===0?outer:inner; const a = i/10 * Math.PI*2;
        i===0 ? shape.moveTo(r*Math.cos(a), r*Math.sin(a)) : shape.lineTo(r*Math.cos(a), r*Math.sin(a));
    }
    shape.closePath(); return shape;
  }, []);
  const geo = useMemo(() => new THREE.ExtrudeGeometry(starShape, { depth: 0.4, bevelEnabled: true }), [starShape]);
  useFrame((_, delta) => {
      if(groupRef.current) {
          const s = state === 'FORMED' ? 1 : 0;
          groupRef.current.scale.lerp(new THREE.Vector3(s,s,s), delta * 2);
          groupRef.current.rotation.y += delta;
      }
  });
  return <group ref={groupRef} position={[0, 12.5, 0]}><mesh geometry={geo}><meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={1} /></mesh></group>;
};

// --- Main Scene (Environment 路径已修复) ---
const Experience = ({ sceneState, rotationSpeed, activeGallery, currentTheme, gyroEnabled, isSnowing, isFireworks }) => {
  const controlsRef = useRef(null);
  useFrame(() => {
    if (controlsRef.current && !gyroEnabled && !activeGallery) {
       controlsRef.current.setAzimuthalAngle(controlsRef.current.getAzimuthalAngle() + rotationSpeed);
       controlsRef.current.update();
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5, 50]} fov={50} />
       
      {gyroEnabled ? (
        <DeviceOrientationControls />
      ) : (
        <OrbitControls ref={controlsRef} enablePan={false} minDistance={20} maxDistance={100} autoRotate={false} maxPolarAngle={Math.PI / 1.7} />
      )}

      <color attach="background" args={[currentTheme.bg]} />
      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      {/* 修复 HDR 路径 */}
      <Environment files={p("/textures/dikhololo_night_1k.hdr")} background={false} />
       
      <ambientLight intensity={0.8} color="#002211" />
      <pointLight position={[30, 30, 30]} intensity={80} color={currentTheme.light} />
       
      <group position={[0, -6, 0]}>
        <Foliage state={sceneState} currentTheme={currentTheme} />
        <Suspense fallback={null}>
           <PhotoOrnaments state={sceneState} />
           <FlyingFrames activeGallery={activeGallery} />
           <CountdownBoard />
           {isSnowing && <Snow />}
           <Fireworks active={isFireworks} />
           <ChristmasElements state={sceneState} />
           <FairyLights state={sceneState} />
           <TopStar state={sceneState} />
        </Suspense>
        <Sparkles count={300} scale={40} size={6} speed={0.4} opacity={0.3} color="#ECEFF1" />
      </group>
    </>
  );
};

// --- 控制器 (AI 模型路径已修复) ---
const GestureController = ({ onGesture, onMove, onStatus, debugMode, onShowGallery, onPlaySound, onCommand }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const propsRef = useRef({ onGesture, onMove, onShowGallery, debugMode, onStatus, onPlaySound, onCommand });
   
  useEffect(() => { propsRef.current = { onGesture, onMove, onShowGallery, debugMode, onStatus, onPlaySound, onCommand }; }, [onGesture, onMove, onShowGallery, debugMode, onStatus, onPlaySound, onCommand]);

  const lastAiRunTime = useRef(0);
  const lastGalleryTriggerTime = useRef(0);

  useEffect(() => {
    let gestureRecognizer;
    let requestRef;
    let running = true;

    const setup = async () => {
      propsRef.current.onStatus("正在加载 AI...");
      try {
        // 修复 WASM 路径
        const vision = await FilesetResolver.forVisionTasks(p("/wasm"));
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
          // 修复模型路径
          baseOptions: { modelAssetPath: p("/models/gesture_recognizer.task"), delegate: "GPU" },
          runningMode: "VIDEO", numHands: 1
        });
        if (!running) return;
        propsRef.current.onStatus("启动摄像头...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } } });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => {
                 console.warn("Autoplay blocked:", e);
                 const clickPlay = () => { videoRef.current?.play(); document.removeEventListener('click', clickPlay); };
                 document.addEventListener('click', clickPlay);
            });
            propsRef.current.onStatus("就绪");
            predictWebcam();
        }
      } catch (err) { console.error(err); propsRef.current.onStatus("摄像头错误"); }
    };

    const countFingers = (landmarks) => {
       let count = 0;
       if (landmarks[8].y < landmarks[6].y) count++; if (landmarks[12].y < landmarks[10].y) count++; 
       if (landmarks[16].y < landmarks[14].y) count++; if (landmarks[20].y < landmarks[18].y) count++; 
       return count;
    };

    const predictWebcam = () => {
      if (!running) return;
      const now = Date.now();
      if (now - lastAiRunTime.current < 100) { requestRef = requestAnimationFrame(predictWebcam); return; }
      lastAiRunTime.current = now;

      const { onGesture, onMove, onShowGallery, debugMode, onStatus, onPlaySound, onCommand } = propsRef.current;

      if (gestureRecognizer && videoRef.current && videoRef.current.readyState === 4 && !videoRef.current.paused) {
           const results = gestureRecognizer.recognizeForVideo(videoRef.current, now);
           const ctx = canvasRef.current?.getContext("2d");
           if (ctx && canvasRef.current && debugMode && results.landmarks) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                canvasRef.current.width = videoRef.current.videoWidth; canvasRef.current.height = videoRef.current.videoHeight;
                for (const landmarks of results.landmarks) {
                    const drawingUtils = new DrawingUtils(ctx);
                    drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#FFD700" });
                    drawingUtils.drawLandmarks(landmarks, { color: "red", lineWidth: 1 });
                }
           }
           if (results.gestures.length > 0) {
               const name = results.gestures[0][0].categoryName;
               const score = results.gestures[0][0].score;
               const landmarks = results.landmarks[0];
               if (score > 0.5) {
                   if (name === "Open_Palm") onGesture("CHAOS");
                   if (name === "Closed_Fist") { onGesture("FORMED"); onShowGallery(null); }
                   if (now - lastGalleryTriggerTime.current > 1000) {
                       let triggered = false;
                       if (name === "Thumb_Up") { onShowGallery('TOP'); triggered = true; onCommand('FIREWORKS'); }
                       else if (name !== "Closed_Fist" && name !== "Open_Palm") {
                           const fCount = countFingers(landmarks);
                           if (fCount >= 1 && fCount <= 4) { onShowGallery(fCount); triggered = true; }
                       }
                       if (triggered) { onPlaySound(); lastGalleryTriggerTime.current = now; }
                   }
                   if (debugMode) onStatus(`手势: ${name}`);
               }
               if (landmarks.length > 0) {
                   const speed = (0.5 - landmarks[0].x) * 0.1;
                   onMove(Math.abs(speed) > 0.02 ? speed : 0);
               }
           } else { onMove(0); }
      }
      requestRef = requestAnimationFrame(predictWebcam);
    };

    setup();
    return () => { running = false; cancelAnimationFrame(requestRef); };
  }, []); 

  return (
    <>
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
      <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, right: 0, width: debugMode ? '320px' : '0px', zIndex: 100, transform: 'scaleX(-1)' }} />
    </>
  );
};

// --- App Entry ---
export default function GrandTreeApp() {
  const [sceneState, setSceneState] = useState('CHAOS');
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const [aiStatus, setAiStatus] = useState("初始化中");
  const [debugMode, setDebugMode] = useState(false);
  const [activeGallery, setActiveGallery] = useState(null);
   
  const [themeKey, setThemeKey] = useState('CLASSIC');
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [isSnowing, setIsSnowing] = useState(false);
  const [isFireworks, setIsFireworks] = useState(false);
  const [musicOn, setMusicOn] = useState(false);

  const playRef = useRef(null);

  const handleGalleryTrigger = useCallback((type) => setActiveGallery(type), []);
  const handlePlaySound = useCallback(() => { if (musicOn) playRef.current?.playSwoosh(); }, [musicOn]);
  const toggleMusic = () => {
    if (!musicOn) { playRef.current?.playBgm(); setMusicOn(true); } 
    else { playRef.current?.pauseBgm(); setMusicOn(false); }
  };
  const handleCommand = useCallback((cmd) => {
      if (cmd === 'SNOW') setIsSnowing(s => !s);
      if (cmd === 'THEME') setThemeKey(p => p==='CLASSIC'?'FROZEN':p==='FROZEN'?'CYBER':'CLASSIC');
      if (cmd === 'FIREWORKS') { setIsFireworks(true); setTimeout(() => setIsFireworks(false), 3000); }
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000', overflow: 'hidden' }}>
      <AudioManager playRef={playRef} />
      <Canvas dpr={[1, 1.5]} gl={{ antialias: false, stencil: false, depth: true, powerPreference: "high-performance" }} shadows={false}>
         <Experience 
            sceneState={sceneState} rotationSpeed={rotationSpeed} activeGallery={activeGallery} 
            currentTheme={THEMES[themeKey]} gyroEnabled={gyroEnabled} isSnowing={isSnowing} isFireworks={isFireworks}
         />
      </Canvas>
      <GestureController 
        onGesture={setSceneState} onMove={setRotationSpeed} onStatus={setAiStatus} 
        debugMode={debugMode} onShowGallery={handleGalleryTrigger} onPlaySound={handlePlaySound} onCommand={handleCommand}
      />
      <div style={{ position: 'absolute', bottom: '30px', left: '30px', zIndex: 10 }}>
        <button onClick={toggleMusic} style={btnStyle}>{musicOn ? '🎵 音乐: 开' : '🔇 音乐: 关'}</button>
      </div>
      <div style={{ position: 'absolute', bottom: '30px', right: '30px', zIndex: 10, display: 'flex', gap: '10px', flexDirection: 'column', alignItems: 'flex-end' }}>
        <button onClick={() => handleCommand('THEME')} style={btnStyle}>🎨 {THEMES[themeKey].name}</button>
        <button onClick={() => setIsSnowing(!isSnowing)} style={btnStyle}>❄️ 下雪: {isSnowing?'开':'关'}</button>
        <button onClick={() => {
            if (typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function') {
                DeviceOrientationEvent.requestPermission().then(r => r==='granted'&&setGyroEnabled(!gyroEnabled));
            } else setGyroEnabled(!gyroEnabled);
        }} style={btnStyle}>📱 陀螺仪: {gyroEnabled?'开':'关'}</button>
        <button onClick={() => setDebugMode(!debugMode)} style={{...btnStyle, fontSize:'10px', opacity:0.5}}>🛠 调试模式</button>
      </div>
      <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', color: 'gold', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', pointerEvents:'none' }}>
        {aiStatus} | {activeGallery ? `照片墙模式` : "圣诞树模式"}
      </div>
    </div>
  );
}

const btnStyle = {
    padding: '8px 15px', background: 'rgba(0,0,0,0.6)', border: '1px solid gold', color: 'gold',
    fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', backdropFilter: 'blur(4px)', marginBottom: '5px'
};
