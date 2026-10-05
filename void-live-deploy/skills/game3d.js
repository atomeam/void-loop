import { loadThree } from './figures3d.js';

const PIECE_TYPES = {
  disc: { radius: 0.4, height: 0.15, bevel: 0.03 },
  cube: { size: 0.7, bevel: 0.05 },
  cylinder: { radius: 0.35, height: 0.5, bevel: 0.03 },
  sphere: { radius: 0.35 },
  cone: { radius: 0.35, height: 0.6, bevel: 0.03 },
  pyramid: { size: 0.5, height: 0.6 },
};

const MATERIALS = {
  wood: { color: 0x8B5A2B, roughness: 0.7, metalness: 0.1 },
  marble: { color: 0xF5F5F5, roughness: 0.2, metalness: 0.3 },
  glass: { color: 0x88CCFF, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.6 },
  metal: { color: 0xAAAAAA, roughness: 0.3, metalness: 0.9 },
  plastic: { color: 0xFF6B6B, roughness: 0.5, metalness: 0.0 },
  stone: { color: 0x888888, roughness: 0.9, metalness: 0.0 },
};

const THEMES = {
  dark: { background: 0x0a0a0f, ambient: 0x404060, directional: 0xffffff, pieces: { player: 0x4A90D9, opponent: 0xD94A4A } },
  light: { background: 0xf0f0f5, ambient: 0x8080a0, directional: 0xffffff, pieces: { player: 0x2171B5, opponent: 0xC62828 } },
};

export class GamePiece {
  constructor(type = 'disc', material = 'wood', color = null) {
    this.type = type;
    this.material = material;
    this.color = color;
    this.mesh = null;
    this.targetPosition = null;
    this.isAnimating = false;
    this.selected = false;
    this.hovered = false;
  }

  async build() {
    const THREE = await loadThree();
    const spec = PIECE_TYPES[this.type] || PIECE_TYPES.disc;
    const mat = MATERIALS[this.material] || MATERIALS.wood;

    let geometry;
    switch (this.type) {
      case 'disc': geometry = new THREE.CylinderGeometry(spec.radius, spec.radius, spec.height, 32); break;
      case 'cube': geometry = new THREE.BoxGeometry(spec.size, spec.size, spec.size); break;
      case 'cylinder': geometry = new THREE.CylinderGeometry(spec.radius, spec.radius, spec.height, 32); break;
      case 'sphere': geometry = new THREE.SphereGeometry(spec.radius, 32, 32); break;
      case 'cone': geometry = new THREE.ConeGeometry(spec.radius, spec.height, 32); break;
      case 'pyramid': geometry = new THREE.ConeGeometry(spec.size, spec.height, 4); break;
      default: geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.15, 32);
    }

    const material = new THREE.MeshPhysicalMaterial({
      color: this.color || mat.color,
      roughness: mat.roughness,
      metalness: mat.metalness,
      clearcoat: mat.metalness > 0.5 ? 0.3 : 0,
      transparent: mat.transparent || false,
      opacity: mat.opacity || 1,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    return this;
  }

  moveTo(x, y, z, duration = 300) {
    this.isAnimating = true;
    const start = { ...this.mesh.position };
    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.mesh.position.x = start.x + (x - start.x) * eased;
      this.mesh.position.y = start.y + (y - start.y) * eased;
      this.mesh.position.z = start.z + (z - start.z) * eased;
      if (t < 1) requestAnimationFrame(animate);
      else this.isAnimating = false;
    };
    animate();
  }

  flip(duration = 400) {
    this.isAnimating = true;
    const startRot = this.mesh.rotation.x;
    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.mesh.rotation.x = startRot + Math.PI * eased;
      if (t < 1) requestAnimationFrame(animate);
      else { this.mesh.rotation.x = startRot + Math.PI; this.isAnimating = false; }
    };
    animate();
  }

  setSelected(selected) {
    this.selected = selected;
    if (this.mesh) this.mesh.material.emissive = new THREE.Color(selected ? 0x333333 : 0x000000);
  }

  setHovered(hovered) {
    this.hovered = hovered;
    if (this.mesh) { const s = hovered ? 1.1 : 1.0; this.mesh.scale.set(s, s, s); }
  }

  dispose() { if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); } }
}

export class GameBoard {
  constructor(theme = 'dark') {
    this.theme = THEMES[theme] || THEMES.dark;
    this.scene = null; this.camera = null; this.renderer = null; this.pieces = []; this.container = null;
  }

  async init(container) {
    const THREE = await loadThree();
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.background);
    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    this.camera.position.set(0, 5, 8);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.AmbientLight(this.theme.ambient, 0.6));
    const dirLight = new THREE.DirectionalLight(this.theme.directional, 0.8);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    this.scene.add(dirLight);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.3 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.animate();
  }

  addPiece(piece) { this.pieces.push(piece); if (piece.mesh) this.scene.add(piece.mesh); }

  removePiece(piece) {
    const idx = this.pieces.indexOf(piece);
    if (idx !== -1) { this.pieces.splice(idx, 1); if (piece.mesh) this.scene.remove(piece.mesh); piece.dispose(); }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    for (const piece of this.pieces) {
      if (piece.isAnimating && piece.targetPosition) {
        piece.mesh.position.lerp(new THREE.Vector3(piece.targetPosition.x, piece.targetPosition.y, piece.targetPosition.z), 0.1);
      }
    }
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    if (this.camera && this.renderer) { this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height); }
  }

  dispose() {
    for (const piece of this.pieces) piece.dispose();
    this.pieces = [];
    if (this.renderer) { this.renderer.dispose(); this.renderer.domElement.remove(); }
  }
}

export function createPiece(type, material, color) { return new GamePiece(type, material, color); }
export { PIECE_TYPES, MATERIALS, THEMES };
