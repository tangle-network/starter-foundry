import { createElement } from "react";
import "./globals.css";

export const metadata = {
  title: "{{headline}}",
  description: "{{subheadline}}"
};

export default function RootLayout({ children }: { children: unknown }) {
  return createElement(
    "html",
    { lang: "en" },
    createElement("body", null, children)
  );
}
