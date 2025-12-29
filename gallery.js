import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

// サムネイル生成用のキャッシュ
const thumbnailCache = new Map();

// 建築物データを読み込んで一覧を表示
async function loadGallery() {
  const gallery = document.getElementById('gallery');
  
  try {
    const response = await fetch('./buildings.json');
    const data = await response.json();
    
    if (!data.buildings || data.buildings.length === 0) {
      gallery.innerHTML = '<div class="error">建築物が見つかりませんでした</div>';
      return;
    }

    gallery.innerHTML = '';

    // 各建築物のカードを作成（サムネイルは非同期で生成）
    for (const building of data.buildings) {
      const card = await createBuildingCard(building);
      gallery.appendChild(card);
    }
  } catch (error) {
    console.error('ギャラリーの読み込みエラー:', error);
    gallery.innerHTML = `<div class="error">エラー: ${error.message}</div>`;
  }
}

// GLTFからサムネイル画像を生成
async function generateThumbnail(modelPath, buildingId) {
  // キャッシュをチェック
  if (thumbnailCache.has(buildingId)) {
    return thumbnailCache.get(buildingId);
  }

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    
    loader.load(
      modelPath,
      (gltf) => {
        try {
          // サムネイル用の小さなシーンを作成
          const width = 400;
          const height = 300;
          
          const scene = new THREE.Scene();
          scene.background = new THREE.Color(0xf0f0f0);
          
          // カメラ
          const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
          
          // ライト
          scene.add(new THREE.AmbientLight(0xffffff, 0.8));
          const light = new THREE.DirectionalLight(0xffffff, 0.8);
          light.position.set(10, 10, 10);
          scene.add(light);
          
          // モデルを追加
          const model = gltf.scene.clone();
          scene.add(model);
          
          // モデルの境界ボックスを計算してカメラを調整
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
          cameraZ *= 1.5; // 少し離す
          
          camera.position.set(
            center.x,
            center.y,
            center.z + cameraZ
          );
          camera.lookAt(center);
          
          // レンダラー
          const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
          renderer.setSize(width, height);
          
          // レンダリング
          renderer.render(scene, camera);
          
          // Canvasから画像データを取得
          const dataURL = renderer.domElement.toDataURL('image/jpeg', 0.9);
          
          // クリーンアップ
          scene.traverse((child) => {
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
          renderer.dispose();
          
          // キャッシュに保存
          thumbnailCache.set(buildingId, dataURL);
          resolve(dataURL);
        } catch (error) {
          console.error('サムネイル生成エラー:', error);
          reject(error);
        }
      },
      undefined,
      (error) => {
        console.error('GLTF読み込みエラー:', error);
        reject(error);
      }
    );
  });
}

// 建築物カードを作成
async function createBuildingCard(building) {
  const card = document.createElement('div');
  card.className = 'building-card';
  card.onclick = () => {
    window.location.href = `./viewer.html?id=${building.id}`;
  };

  // サムネイル
  const thumbnail = document.createElement('div');
  thumbnail.className = 'thumbnail';
  
  // プレースホルダーを表示
  thumbnail.innerHTML = '<div class="thumbnail-placeholder">🏰</div>';
  
  // サムネイルを生成（非同期）
  generateThumbnail(building.modelPath, building.id)
    .then(dataURL => {
      const img = document.createElement('img');
      img.src = dataURL;
      img.alt = building.name;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      thumbnail.innerHTML = '';
      thumbnail.appendChild(img);
    })
    .catch(error => {
      console.error(`サムネイル生成失敗 (${building.name}):`, error);
      // エラー時はプレースホルダーのまま
    });

  // コンテンツ
  const content = document.createElement('div');
  content.className = 'card-content';
  
  const title = document.createElement('h2');
  title.textContent = building.name;
  
  const description = document.createElement('p');
  description.textContent = building.description || '説明なし';
  
  const footer = document.createElement('div');
  footer.className = 'card-footer';
  
  const author = document.createElement('span');
  author.textContent = building.author ? `作成者: ${building.author}` : '';
  
  const viewButton = document.createElement('button');
  viewButton.className = 'view-button';
  viewButton.textContent = '詳細を見る';
  viewButton.onclick = (e) => {
    e.stopPropagation();
    window.location.href = `./viewer.html?id=${building.id}`;
  };

  content.appendChild(title);
  content.appendChild(description);
  footer.appendChild(author);
  footer.appendChild(viewButton);
  content.appendChild(footer);

  card.appendChild(thumbnail);
  card.appendChild(content);

  return card;
}

// ページ読み込み時にギャラリーを読み込む
loadGallery();

