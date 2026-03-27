import { createElement } from "react";

const principles = [
  "Show a real artifact before all dependencies finish.",
  "Keep the starter composable so partners can swap core dependencies.",
  "Leave clear extension seams for the agent."
];

export default function App() {
  return createElement(
    "main",
    { className: "app-shell" },
    createElement("h1", null, "{{headline}}"),
    createElement("p", null, "{{subheadline}}"),
    createElement(
      "ul",
      null,
      ...principles.map((item) => createElement("li", { key: item }, item))
    )
  );
}
