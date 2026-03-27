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
    <article class="brand-card">
      <p class="eyebrow">Partner Pack</p>
      <h2>${brand.name}</h2>
      <p>${brand.message}</p>
    </article>
  `;
}

function renderMetrics(data) {
  const target = document.querySelector("#metrics");
  if (!target || !Array.isArray(data?.cards)) {
    return;
  }

  target.innerHTML = `
    <ol class="step-list">
      ${data.cards.map((card) => `<li><strong>${card.label}:</strong> ${card.value} <span>${card.note}</span></li>`).join("")}
    </ol>
  `;
}

const [brand, metrics] = await Promise.all([
  loadJson("/starter-brand.json"),
  loadJson("/starter-data.json")
]);

renderBrand(brand);
renderMetrics(metrics);
