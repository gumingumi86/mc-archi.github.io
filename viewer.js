import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

// URLパラメータから建築物IDを取得
const urlParams = new URLSearchParams(window.location.search);
const buildingId = urlParams.get('id') || 'castle';

let scene, camera, renderer, controls;
let currentModel = null;

// 建築物データを読み込む
async function loadBuildingData() {
  try {
    const response = await fetch('./buildings.json');
    const data = await response.json();
    const building = data.buildings.find(b => b.id === buildingId);
    
    if (!building) {
      throw new Error(`建築物ID "${buildingId}" が見つかりません`);
    }
    
    // UIを更新
    document.getElementById('building-name').textContent = building.name;
    document.getElementById('building-description').textContent = building.description || '';
    
    return building;
  } catch (error) {
    showError(`データの読み込みに失敗しました: ${error.message}`);
    throw error;
  }
}

// シーンを初期化
function initScene() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  // Camera
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  camera.position.set(5, 5, 5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(10, 10, 10);
  scene.add(light);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
}

// モデルを読み込む
function loadModel(modelPath) {
  const loader = new GLTFLoader();
  
  loader.load(
    modelPath,
    (gltf) => {
      // 既存のモデルを削除
      if (currentModel) {
        scene.remove(currentModel);
        currentModel.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }

      currentModel = gltf.scene;
      scene.add(currentModel);

      // カメラをモデルに合わせて調整
      const box = new THREE.Box3().setFromObject(currentModel);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());

      controls.target.copy(center);
      camera.position.set(
        center.x + size,
        center.y + size * 0.6,
        center.z + size
      );

      camera.near = size / 100;
      camera.far = size * 10;
      camera.updateProjectionMatrix();

      // ローディングを非表示
      document.getElementById('loading').style.display = 'none';
    },
    (progress) => {
      // プログレス表示（オプション）
      const percent = (progress.loaded / progress.total * 100).toFixed(0);
      document.getElementById('loading').textContent = `モデルを読み込み中... ${percent}%`;
    },
    (error) => {
      console.error("Failed to load GLTF model", error);
      showError(`モデルの読み込みに失敗しました: ${error.message}`);
    }
  );
}

// エラーを表示
function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'block';
  document.getElementById('error-message').textContent = message;
}

// リサイズ処理
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// アニメーションループ
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// 初期化
async function init() {
  try {
    initScene();
    const building = await loadBuildingData();
    loadModel(building.modelPath);
    animate();
  } catch (error) {
    console.error('初期化エラー:', error);
  }
}

init();

