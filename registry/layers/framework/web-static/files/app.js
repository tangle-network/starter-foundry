async function loadJson(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

function renderBrand(brand) {
  const target = document.querySelector("#brand");
  if (!target || !brand) {
    return;
  }

  target.innerHTML = `
    <div class="brand-card">
      <span class="brand-kicker">Partner Pack</span>
      <h2>${brand.name}</h2>
      <p>${brand.message}</p>
    </div>
  `;
}

function renderMetrics(data) {
  const target = document.querySelector("#metrics");
  if (!target || !Array.isArray(data?.cards)) {
    return;
  }

  target.innerHTML = data.cards
    .map(
      (card) => `
        <article class="metric-card">
          <span class="metric-label">${card.label}</span>
          <strong class="metric-value">${card.value}</strong>
          <p class="metric-note">${card.note}</p>
        </article>
      `,
    )
    .join("");
}

const [brand, data] = await Promise.all([
  loadJson("/starter-brand.json"),
  loadJson("/starter-data.json"),
]);

renderBrand(brand);
renderMetrics(data);
