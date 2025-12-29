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

    data.buildings.forEach(building => {
      const card = createBuildingCard(building);
      gallery.appendChild(card);
    });
  } catch (error) {
    console.error('ギャラリーの読み込みエラー:', error);
    gallery.innerHTML = `<div class="error">エラー: ${error.message}</div>`;
  }
}

// 建築物カードを作成
function createBuildingCard(building) {
  const card = document.createElement('div');
  card.className = 'building-card';
  card.onclick = () => {
    window.location.href = `./viewer.html?id=${building.id}`;
  };

  // サムネイル
  const thumbnail = document.createElement('div');
  thumbnail.className = 'thumbnail';
  
  if (building.thumbnail) {
    const img = document.createElement('img');
    img.src = building.thumbnail;
    img.alt = building.name;
    img.onerror = () => {
      thumbnail.innerHTML = '<div class="thumbnail-placeholder">🏰</div>';
    };
    thumbnail.appendChild(img);
  } else {
    thumbnail.innerHTML = '<div class="thumbnail-placeholder">🏰</div>';
  }

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

