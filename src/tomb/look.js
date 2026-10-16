// The cinematic look: film-like colour (ACES), warm dusty haze, and a soft glow (bloom) around fire,
// crystals and gold. Phones get a lighter version so the game stays smooth.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const LOW = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

export function setupLook(renderer, scene, camera) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.5 : 2));
  scene.background = new THREE.Color('#1c1209');
  scene.fog = new THREE.FogExp2('#2a1a0c', LOW ? 0.034 : 0.03);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.55, 0.78);
  if (LOW) bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  addEventListener('resize', () => { composer.setSize(innerWidth, innerHeight); });
  composer.setSize(innerWidth, innerHeight);
  return { render: () => composer.render() };
}
