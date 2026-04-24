import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { RenderState } from '../state/store';

/**
 * Screen-Y tilt-shift — cheap box blur whose radius ramps up as a pixel moves
 * away from the focus line. Ortho cameras can't do optical DOF, but iso scenes
 * look great with this "miniature" blur. The `weightForDistance` call is the
 * artistic curve — swap it for a different falloff (pow, step, narrower
 * smoothstep) to change the character of the defocus band.
 */
const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    focusY: { value: 0.5 },
    focusRange: { value: 0.15 },
    maxBlur: { value: 3.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float focusY;
    uniform float focusRange;
    uniform float maxBlur;
    varying vec2 vUv;

    float weightForDistance(float d, float range) {
      return smoothstep(range, range + 0.30, d);
    }

    void main() {
      float d = abs(vUv.y - focusY);
      float t = weightForDistance(d, focusRange);
      float r = maxBlur * t;
      if (r < 0.01) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }
      vec2 px = r / resolution;
      vec4 sum = vec4(0.0);
      for (float i = -2.0; i <= 2.0; i += 1.0) {
        for (float j = -2.0; j <= 2.0; j += 1.0) {
          sum += texture2D(tDiffuse, vUv + vec2(i, j) * px);
        }
      }
      gl_FragColor = sum / 25.0;
    }
  `,
};

export type PostprocessPipeline = {
  composer: EffectComposer;
  outlinePass: OutlinePass;
  tiltPass: ShaderPass;
  smaaPass: SMAAPass;
  setSize: (w: number, h: number) => void;
  setOutlineTargets: (meshes: THREE.Object3D[]) => void;
  apply: (state: RenderState) => void;
  dispose: () => void;
};

/**
 * Build a full post-processing chain for the preview renderer:
 *   RenderPass → OutlinePass → Tilt-shift → SMAA → OutputPass
 * SMAA is placed last because every upstream pass can introduce aliasing
 * (outline edges, blur sampling) — a single AA pass at the end cleans them
 * all up. OutputPass handles tonemap/colorspace encoding for the final image.
 */
export function createPostprocess(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
): PostprocessPipeline {
  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);

  composer.addPass(new RenderPass(scene, camera));

  const outlinePass = new OutlinePass(
    new THREE.Vector2(width, height),
    scene,
    camera,
  );
  outlinePass.visibleEdgeColor.set('#1a1a1a');
  outlinePass.hiddenEdgeColor.set('#1a1a1a');
  outlinePass.edgeStrength = 3.0;
  outlinePass.edgeThickness = 2.0;
  outlinePass.edgeGlow = 0;
  outlinePass.enabled = false;
  composer.addPass(outlinePass);

  const tiltPass = new ShaderPass(TiltShiftShader);
  tiltPass.uniforms.resolution.value = new THREE.Vector2(width, height);
  tiltPass.enabled = false;
  composer.addPass(tiltPass);

  const smaaPass = new SMAAPass();
  smaaPass.setSize(width, height);
  composer.addPass(smaaPass);

  composer.addPass(new OutputPass());

  const setSize = (w: number, h: number) => {
    composer.setSize(w, h);
    outlinePass.setSize(w, h);
    tiltPass.uniforms.resolution.value.set(w, h);
    smaaPass.setSize(w, h);
  };

  const setOutlineTargets = (meshes: THREE.Object3D[]) => {
    outlinePass.selectedObjects = meshes;
  };

  const apply = (state: RenderState) => {
    outlinePass.enabled = state.outlineEnabled;
    outlinePass.visibleEdgeColor.set(state.outlineColor);
    outlinePass.hiddenEdgeColor.set(state.outlineColor);
    outlinePass.edgeThickness = state.outlineThickness;
    outlinePass.edgeStrength = state.outlineStrength;

    tiltPass.enabled = state.tiltShiftEnabled;
    tiltPass.uniforms.focusY.value = state.tiltShiftFocusY;
    tiltPass.uniforms.focusRange.value = state.tiltShiftRange;
    tiltPass.uniforms.maxBlur.value = state.tiltShiftBlur;
  };

  const dispose = () => {
    composer.dispose();
  };

  return {
    composer,
    outlinePass,
    tiltPass,
    smaaPass,
    setSize,
    setOutlineTargets,
    apply,
    dispose,
  };
}
