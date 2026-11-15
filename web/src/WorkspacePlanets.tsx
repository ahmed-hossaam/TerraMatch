import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo, useRef } from "react";

function textureFor(kind: "blue" | "rust" | "ice") {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  let seed = kind === "blue" ? 7401 : kind === "rust" ? 3989 : 1853;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  if (kind === "blue") {
    const ocean = ctx.createLinearGradient(0, 0, 0, 512);
    ocean.addColorStop(0, "#105174"); ocean.addColorStop(.5, "#12618a"); ocean.addColorStop(1, "#092d50");
    ctx.fillStyle = ocean; ctx.fillRect(0, 0, 1024, 512);
    // Irregular land masses provide visible surface detail as the sphere turns.
    for (let i = 0; i < 24; i++) {
      const x = random() * 1024, y = 36 + random() * 440;
      const rx = 20 + random() * 88, ry = 10 + random() * 46;
      ctx.beginPath();
      for (let j = 0; j <= 18; j++) {
        const a = j / 18 * Math.PI * 2, wobble = .72 + random() * .5;
        const px = x + Math.cos(a) * rx * wobble, py = y + Math.sin(a) * ry * wobble;
        if (!j) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fillStyle = i % 3 ? "#477454" : "#8b8a5e"; ctx.fill();
      ctx.strokeStyle = "rgba(194,190,139,.3)"; ctx.lineWidth = 2; ctx.stroke();
    }
    for (let i = 0; i < 220; i++) {
      const x = random() * 1024, y = random() * 512;
      ctx.fillStyle = `rgba(231,245,255,${.05 + random() * .18})`;
      ctx.beginPath(); ctx.ellipse(x, y, 8 + random() * 44, 2 + random() * 7, random() * .35, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === "rust") {
    const surface = ctx.createLinearGradient(0, 0, 0, 512);
    surface.addColorStop(0, "#8c3829"); surface.addColorStop(.45, "#d36b3e"); surface.addColorStop(1, "#612620");
    ctx.fillStyle = surface; ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 900; i++) {
      const x = random() * 1024, y = random() * 512, r = 1 + random() * 13;
      ctx.fillStyle = random() > .48 ? `rgba(53,22,19,${.08 + random() * .22})` : `rgba(255,177,111,${.04 + random() * .16})`;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (.24 + random() * .34), random(), 0, Math.PI * 2); ctx.fill();
    }
  } else {
    const surface = ctx.createLinearGradient(0, 0, 0, 512);
    surface.addColorStop(0, "#afcce0"); surface.addColorStop(.5, "#5f88a5"); surface.addColorStop(1, "#243d59");
    ctx.fillStyle = surface; ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 240; i++) {
      const x = random() * 1024, y = random() * 512;
      ctx.fillStyle = `rgba(235,246,255,${.06 + random() * .3})`;
      ctx.beginPath(); ctx.ellipse(x, y, 3 + random() * 35, 2 + random() * 10, random() * .3, 0, Math.PI * 2); ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function Rim({ radius, color }: { radius: number; color: string }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec3 n; varying vec3 v; void main(){n=normalize(normalMatrix*normal); vec4 p=modelViewMatrix*vec4(position,1.); v=normalize(-p.xyz); gl_Position=projectionMatrix*p;}",
    fragmentShader: `varying vec3 n; varying vec3 v; void main(){float rim=pow(1.0-max(dot(normalize(n),normalize(v)),0.0),3.2); gl_FragColor=vec4(${new THREE.Color(color).toArray().map((n) => n.toFixed(4)).join(",")},rim*.58);}`,
  }), [color]);
  return <mesh scale={radius * 1.075}><sphereGeometry args={[1, 40, 32]} /><primitive object={material} attach="material" /></mesh>;
}

function Planet({ kind, x, y, radius, spin, phase = 0, reducedMotion }: { kind: "blue" | "rust" | "ice"; x: number; y: number; radius: number; spin: number; phase?: number; reducedMotion: boolean }) {
  const tilt = useRef<THREE.Group>(null);
  const surface = useMemo(() => textureFor(kind), [kind]);
  const rim = kind === "blue" ? "#55bce8" : kind === "rust" ? "#ec7951" : "#90c7ed";
  useFrame(({ clock }, dt) => {
    if (!tilt.current) return;
    if (reducedMotion) return;
    tilt.current.rotation.y += dt * spin;
    const t = clock.elapsedTime + phase;
    tilt.current.position.set(x + Math.sin(t * .11) * 4, y + Math.cos(t * .09) * 3, kind === "rust" ? -14 : kind === "ice" ? -24 : 0);
  });
  return <group ref={tilt} position={[x, y, 0]}>
    <group rotation={[kind === "rust" ? .18 : -.12, 0, kind === "ice" ? -.2 : .08]}>
      <mesh><sphereGeometry args={[radius, 48, 36]} /><meshStandardMaterial map={surface} roughness={.96} metalness={.015} /></mesh>
      <Rim radius={radius} color={rim} />
    </group>
  </group>;
}

function PlanetField() {
  const { size, camera } = useThree();
  const c = camera as THREE.OrthographicCamera;
  c.left = 0; c.right = size.width; c.top = size.height; c.bottom = 0; c.near = .1; c.far = 3000; c.position.set(0, 0, 1200); c.lookAt(0, 0, 0); c.updateProjectionMatrix();
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const blueSize = Math.max(280, Math.min(430, size.width * .30));
  const rustSize = Math.max(160, Math.min(240, size.width * .17));
  const iceSize = size.width <= 760 ? 100 : 126;
  const mobile = size.width <= 760;
  return <>
    <ambientLight intensity={.62} />
    <directionalLight position={[size.width * .38, -size.height * .32, 900]} intensity={2.1} color="#fff1dc" />
    <Planet kind="blue" x={mobile ? -172 + blueSize / 2 : -210 + blueSize / 2} y={size.height + (mobile ? 190 : 212) - blueSize / 2} radius={blueSize / 2} spin={.085} reducedMotion={reducedMotion} />
    <Planet kind="rust" x={size.width - (mobile ? 112 : 126) + rustSize / 2} y={(mobile ? 12 : 14) * size.height / 100 + rustSize / 2} radius={rustSize / 2} spin={-.13} phase={2.4} reducedMotion={reducedMotion} />
    <Planet kind="ice" x={(mobile ? -73 : -84) + iceSize / 2} y={(mobile ? 5 : 7) * size.height / 100 + iceSize / 2} radius={iceSize / 2} spin={.19} phase={4.1} reducedMotion={reducedMotion} />
  </>;
}

export default function WorkspacePlanets({ onReady }: { onReady?: () => void }) {
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  return <div className="workspace-planet-render" aria-hidden="true"><Canvas onCreated={onReady} frameloop={reducedMotion ? "demand" : "always"} orthographic dpr={1} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}><PlanetField /></Canvas></div>;
}
