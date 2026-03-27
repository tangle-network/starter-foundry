const root = document.querySelector("#app");

if (root) {
  root.innerHTML = `
    <h1>{{headline}}</h1>
    <p>{{subheadline}}</p>
    <div class="card">Desktop command palette, file access, and auth flows belong here.</div>
  `;
}
