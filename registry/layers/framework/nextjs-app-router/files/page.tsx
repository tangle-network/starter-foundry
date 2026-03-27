import { createElement } from "react";

const steps = [
  "Hydrate an immediate shell before long installs finish.",
  "Use slots to steer partner-preferred dependencies.",
  "Let the agent extend a familiar app router layout."
];

export default function Page() {
  return createElement(
    "main",
    { className: "page-shell" },
    createElement("p", { className: "eyebrow" }, "{{projectName}}"),
    createElement("h1", null, "{{headline}}"),
    createElement("p", { className: "subheadline" }, "{{subheadline}}"),
    createElement(
      "ol",
      { className: "step-list" },
      ...steps.map((step) => createElement("li", { key: step }, step))
    )
  );
}
