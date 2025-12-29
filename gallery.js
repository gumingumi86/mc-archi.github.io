import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

// サムネイルビューアーの管理
const thumbnailViewers = new Map();

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

// インタラクティブな3Dサムネイルビューアーを作成
function createThumbnailViewer(container, modelPath, buildingId) {
  return new Promise((resolve, reject) => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // シーン
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // カメラ
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    
    // レンダラー
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // パフォーマンスのため制限
    container.appendChild(renderer.domElement);
    
    // ライト
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(10, 10, 10);
    scene.add(light);
    
    // モデルを読み込む
    const loader = new GLTFLoader();
    let model = null;
    let modelCenter = new THREE.Vector3();
    let modelRadius = 1;
    let cameraDistance = 5;
    
    loader.load(
      modelPath,
      (gltf) => {
        model = gltf.scene;
        scene.add(model);
        
        // モデルの境界ボックスを計算
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        modelCenter = box.getCenter(new THREE.Vector3());
        modelRadius = Math.max(size.x, size.y, size.z) / 2;
        cameraDistance = modelRadius * 2.5;
        
        // 初期カメラ位置
        camera.position.set(
          modelCenter.x + cameraDistance,
          modelCenter.y + cameraDistance * 0.5,
          modelCenter.z + cameraDistance
        );
        camera.lookAt(modelCenter);
        
        // マウス位置に基づく回転
        let targetRotationX = 0;
        let targetRotationY = 0;
        let currentRotationX = 0;
        let currentRotationY = 0;
        let isHovering = false;
        
        container.addEventListener('mouseenter', () => {
          isHovering = true;
        });
        
        container.addEventListener('mouseleave', () => {
          isHovering = false;
          // マウスが離れたら元の位置に戻す
          targetRotationX = 0;
          targetRotationY = 0;
        });
        
        container.addEventListener('mousemove', (e) => {
          if (!isHovering || !model) return;
          
          const rect = container.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y = (e.clientY - rect.top) / rect.height;
          
          // マウス位置を-1から1の範囲にマッピング
          targetRotationY = (x - 0.5) * Math.PI * 0.5; // 左右回転
          targetRotationX = (0.5 - y) * Math.PI * 0.3; // 上下回転（制限）
        });
        
        // アニメーションループ
        let animationId = null;
        function animate() {
          animationId = requestAnimationFrame(animate);
          
          if (!model) return;
          
          // スムーズな回転補間
          currentRotationX += (targetRotationX - currentRotationX) * 0.1;
          currentRotationY += (targetRotationY - currentRotationY) * 0.1;
          
          // カメラを球面座標で配置
          const phi = Math.PI / 3 + currentRotationX; // 上下角度
          const theta = Math.PI / 4 + currentRotationY; // 左右角度
          
          camera.position.x = modelCenter.x + cameraDistance * Math.sin(phi) * Math.cos(theta);
          camera.position.y = modelCenter.y + cameraDistance * Math.cos(phi);
          camera.position.z = modelCenter.z + cameraDistance * Math.sin(phi) * Math.sin(theta);
          
          camera.lookAt(modelCenter);
          
          renderer.render(scene, camera);
        }
        
        animate();
        
        // リサイズ処理
        let resizeObserver = null;
        let handleResize = null;
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
          });
          resizeObserver.observe(container);
        } else {
          // ResizeObserverが使えない場合はwindowリサイズイベントを使用
          handleResize = () => {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
          };
          window.addEventListener('resize', handleResize);
        }
        
        // クリーンアップ関数を持つビューアーオブジェクトを作成
        const viewer = {
          dispose: () => {
            if (animationId) {
              cancelAnimationFrame(animationId);
            }
            if (resizeObserver) {
              resizeObserver.disconnect();
            }
            if (handleResize) {
              window.removeEventListener('resize', handleResize);
            }
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
            if (container.contains(renderer.domElement)) {
              container.removeChild(renderer.domElement);
            }
          }
        };
        
        // 成功時にPromiseを解決（viewerオブジェクトを返す）
        resolve(viewer);
      },
      undefined,
      (error) => {
        console.error(`サムネイル読み込みエラー (${buildingId}):`, error);
        container.innerHTML = '<div class="thumbnail-placeholder">🏰</div>';
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

  // サムネイル（インタラクティブ3Dビューアー）
  const thumbnail = document.createElement('div');
  thumbnail.className = 'thumbnail';
  thumbnail.style.position = 'relative';
  thumbnail.style.overflow = 'hidden';
  
  // プレースホルダーを表示
  thumbnail.innerHTML = '<div class="thumbnail-placeholder">🏰</div>';
  
  // インタラクティブな3Dサムネイルを作成（非同期）
  createThumbnailViewer(thumbnail, building.modelPath, building.id)
    .then(viewer => {
      thumbnailViewers.set(building.id, viewer);
      // プレースホルダーを削除
      const placeholder = thumbnail.querySelector('.thumbnail-placeholder');
      if (placeholder) {
        placeholder.remove();
      }
    })
    .catch(error => {
      console.error(`サムネイル作成失敗 (${building.name}):`, error);
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

