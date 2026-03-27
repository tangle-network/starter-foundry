const root = document.querySelector("#app");

if (root) {
  root.innerHTML = `
    <h1>{{headline}}</h1>
    <p>{{subheadline}}</p>
    <ul>
      <li>Inspect the active tab</li>
      <li>Trigger quick actions</li>
      <li>Connect auth or wallet state</li>
    </ul>
  `;
}
