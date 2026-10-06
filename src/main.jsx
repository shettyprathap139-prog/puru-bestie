import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import "./styles.css";

const PHOTOS = ["/photos/1000259243.jpg", "/photos/1000259245.jpg"];

function CinematicScene({ progress }) {
  const mount = useRef(null);
  const sceneRef = useRef(null);
  const shipRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05030a, 0.045);

    const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, 1.6, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffd7b0, 0x090611, 1.6);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffb36b, 2.2);
    sun.position.set(-5, 8, 5);
    scene.add(sun);

    // Star / ember field
    const count = 1300;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i*3] = (Math.random()-0.5)*42;
      positions[i*3+1] = (Math.random()-0.35)*25;
      positions[i*3+2] = -Math.random()*35;
      sizes[i] = 0.4 + Math.random()*1.7;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions,3));
    const starMat = new THREE.PointsMaterial({
      color: 0xff9cc8, size: 0.055, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Ocean
    const oceanGeo = new THREE.PlaneGeometry(70, 70, 80, 80);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x100b18, roughness: 0.25, metalness: 0.25,
      transparent: true, opacity: 0.92
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI/2;
    ocean.position.y = -3.2;
    scene.add(ocean);

    // Glowing horizon
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(35, 10),
      new THREE.MeshBasicMaterial({ color: 0xd45d7f, transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending })
    );
    glow.position.set(0, 0.5, -14);
    scene.add(glow);

    // Ship billboard with blue-sky removal shader.
    const loader = new THREE.TextureLoader();
    loader.load("/ship.png", (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: texture }, opacity: { value: 1 } },
        transparent: true,
        depthWrite: false,
        vertexShader: `
          varying vec2 vUv;
          void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
        `,
        fragmentShader: `
          uniform sampler2D map;
          uniform float opacity;
          varying vec2 vUv;
          void main(){
            vec4 c=texture2D(map,vUv);
            // Remove the bright cyan/blue sky around the ship.
            float blue=max(c.b-max(c.r,c.g)*0.96,0.0);
            float sky=smoothstep(0.08,0.28,blue);
            float edge=1.0-smoothstep(0.55,0.92,c.b-c.r*0.15);
            float a=c.a*(1.0-sky*0.82)*opacity;
            if(a<0.035) discard;
            gl_FragColor=vec4(c.rgb,a);
          }
        `
      });
      const ship = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 5.0), mat);
      ship.position.set(0, -0.65, -11.5);
      shipRef.current = ship;
      scene.add(ship);
    });

    const onResize = () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    };
    addEventListener("resize", onResize);

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const p = window.__sceneProgress || 0;
      stars.rotation.y += 0.00025;
      oceanGeo.attributes.position.needsUpdate = true;

      // Camera sails forward through the scene.
      camera.position.z = 9 - p * 10;
      camera.position.y = 1.6 - p * 0.8;
      camera.rotation.z = Math.sin(p * Math.PI) * 0.012;

      if (shipRef.current) {
        const ship = shipRef.current;
        ship.position.z = -11.5 + p * 9.5;
        ship.position.x = Math.sin(p * Math.PI * 1.2) * 1.3;
        ship.position.y = -0.65 + Math.sin(p * Math.PI) * 0.35;
        ship.rotation.z = Math.sin(p * Math.PI * 2) * 0.035;
        const s = 0.72 + p * 1.35;
        ship.scale.set(s, s, s);
        ship.material.uniforms.opacity.value = Math.min(1, 0.25 + p * 1.5);
      }
      renderer.render(scene,camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      removeEventListener("resize", onResize);
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  window.__sceneProgress = progress;
  return <div ref={mount} className="scene-canvas" aria-hidden="true"/>;
}

function CatCursor() {
  const [p, setP] = useState({x:-100,y:-100});
  useEffect(() => {
    const move=e=>setP({x:e.clientX,y:e.clientY});
    addEventListener("pointermove",move);
    return()=>removeEventListener("pointermove",move);
  },[]);
  return <div className="cat-cursor" style={{left:p.x,top:p.y}}><span>🐱</span></div>;
}

function SwipeGallery() {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const pointerId = useRef(null);

  const goNext = () => {
    setIndex((i) => (i + 1) % PHOTOS.length);
    setDragX(0);
  };

  const goPrev = () => {
    setIndex((i) => (i - 1 + PHOTOS.length) % PHOTOS.length);
    setDragX(0);
  };

  const onPointerDown = (e) => {
    dragging.current = true;
    startX.current = e.clientX;
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragX(0);
  };

  const onPointerMove = (e) => {
    if (!dragging.current || pointerId.current !== e.pointerId) return;
    setDragX(e.clientX - startX.current);
  };

  const finishSwipe = (e) => {
    if (!dragging.current) return;
    const distance = e.clientX - startX.current;
    dragging.current = false;
    pointerId.current = null;

    if (distance < -65) goNext();
    else if (distance > 65) goPrev();
    else setDragX(0);
  };

  const cancelSwipe = () => {
    dragging.current = false;
    pointerId.current = null;
    setDragX(0);
  };

  return (
    <div className="swipe-wrap">
      <div
        className="swipe-stack"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishSwipe}
        onPointerCancel={cancelSwipe}
        onLostPointerCapture={cancelSwipe}
        role="group"
        aria-label="Swipe memories"
      >
        {PHOTOS.map((src, i) => {
          const offset = (i - index + PHOTOS.length) % PHOTOS.length;
          if (offset > 1) return null;

          const front = offset === 0;
          return (
            <img
              key={src}
              className={"memory-card " + (front ? "front" : "back")}
              src={src}
              alt={`Memory ${i + 1}`}
              draggable="false"
              onDragStart={(e) => e.preventDefault()}
              style={
                front
                  ? {
                      transform: `translateX(${dragX}px) rotate(${dragX / 22}deg)`,
                      transition: dragging.current ? "none" : "transform .25s ease",
                    }
                  : undefined
              }
            />
          );
        })}
        <div className="swipe-direction left">‹</div>
        <div className="swipe-direction right">›</div>
      </div>

      <div className="swipe-controls">
        <button type="button" onClick={goPrev} aria-label="Previous memory">←</button>
        <span>SWIPE LEFT / RIGHT</span>
        <button type="button" onClick={goNext} aria-label="Next memory">→</button>
      </div>
    </div>
  );
}

function App(){
  const [progress,setProgress]=useState(0);
  useEffect(()=>{
    const onScroll=()=>{
      const max=Math.max(1,innerHeight*1.55);
      setProgress(Math.min(1,Math.max(0,scrollY/max)));
    };
    addEventListener("scroll",onScroll,{passive:true});
    onScroll();
    return()=>removeEventListener("scroll",onScroll);
  },[]);

  return <>
    <CatCursor/>
    <section className="hero">
      <CinematicScene progress={progress}/>
      <div className="vignette"/>
      <div className="hero-copy hero-slide hero-slide-one">
        <div className="eyebrow"><i/> A MESSAGE ACROSS THE GRAND LINE</div>
        <h1><span>FOR</span><em>PURU.</em></h1>
        <p>Some things are easier to say<br/>when you turn them into a journey.</p>
      </div>

      <div className="hero-copy hero-slide hero-slide-two">
        <div className="eyebrow"><i/> BEFORE THE NEXT CHAPTER</div>
        <h2>Some journeys<br/><em>deserve another page.</em></h2>
        <p>The ship is getting closer.<br/>So is everything I wanted to say.</p>
      </div>

      <div className="scroll-label">SCROLL <b>↓</b></div>
    </section>

    <section className="bounty">
      <div className="bounty-bg"/>
      <div className="poster">
        <div className="wanted">WANTED</div>
        <div className="poster-name">PURU</div>
        <div className="poster-rule"/>
        <div className="poster-photos">
          <img src={PHOTOS[0]} alt="memory"/>
          <img src={PHOTOS[1]} alt="memory"/>
        </div>
        <div className="poster-sub">FOR BEING ONE OF MY FAVORITE PEOPLE</div>
        <div className="reward">∞ BERRIES</div>
      </div>
      <div className="chapter-tag">CHAPTER 00 · THE PERSON THIS IS FOR</div>
    </section>

    <main className="story">
      <section className="chapter">
        <div className="chapter-no">01</div>
        <div><div className="eyebrow">THE TRUTH</div><h2>Why I needed<br/><em>to explain.</em></h2>
        <p>Those friendship-ending messages were sent while I didn't have access to my WhatsApp.</p>
        <p>A friend had access to my WhatsApp at that time and sent them to you. You believed they came from me, and I understand why that hurt.</p></div>
      </section>

      <section className="chapter soft">
        <div className="chapter-no">02</div>
        <div><div className="eyebrow">WHAT HAPPENED</div><h2>It was never meant<br/><em>to end like that.</em></h2>
        <p>Everything changed because of messages that looked like they came from me. I know that from your side, there was no way to know what was really happening.</p>
        <p>I'm not asking you to forget how it felt. I just wanted you to know what actually happened.</p></div>
      </section>

      <section className="chapter">
        <div className="chapter-no">03</div>
        <div><div className="eyebrow">I'M SORRY</div><h2>One bad phase<br/><em>shouldn't erase everything.</em></h2>
        <p>Maybe things got messy. Maybe we misunderstood each other. But I don't want one bad phase to erase everything good that came before it.</p>
        <p>I'm sorry for the moments where my words or actions made you feel hurt or unwanted.</p></div>
      </section>

      <section className="memories chapter-four">
        <div className="chapter-no">04</div>
        <div className="eyebrow">MEMORIES</div>
        <h2>Some moments<br/><em>still matter.</em></h2>
        <SwipeGallery/>
      </section>

      <section className="chapter soft">
        <div className="chapter-no">05</div>
        <div><div className="eyebrow">THE CHOICE</div><h2>Whatever happens,<br/><em>thank you.</em></h2>
        <p>I don't want to force an answer. I just wanted to tell you the truth and leave the next page to you.</p>
        <div className="quote-mini"><span>“When do you think people die? When they are forgotten.”</span><small>— ONE PIECE</small></div>
        <div className="actions">
          <a href="https://wa.me/?text=Shetty%2C%20I%20read%20your%20card.%20Yes%2C%20let%27s%20start%20again%20and%20be%20besties.%20%E2%9D%A4%EF%B8%8F" target="_blank" rel="noreferrer">YES, LET'S START AGAIN</a>
          <a href="https://wa.me/?text=Shetty%2C%20I%20read%20your%20card.%20I%20need%20some%20time%2C%20but%20I%20wanted%20you%20to%20know%20I%20saw%20it.%20%F0%9F%8C%B7" target="_blank" rel="noreferrer">I NEED SOME TIME</a>
        </div></div>
      </section>
    </main>
  </>;
}
createRoot(document.getElementById("root")).render(<App/>);
