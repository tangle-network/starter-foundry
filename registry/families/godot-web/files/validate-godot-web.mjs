// Structural validator for godot-web. Does NOT run the Godot editor or
// attempt an export — both require the Godot binary plus matching export
// templates. Confirms the project + scene + script wiring is consistent
// and the Web export preset is present.

import fs from "node:fs/promises";

const [projectFile, exportPresets, mainTscn, mainGd] = await Promise.all([
  fs.readFile("project.godot", "utf8"),
  fs.readFile("export_presets.cfg", "utf8"),
  fs.readFile("scenes/main.tscn", "utf8"),
  fs.readFile("scripts/main.gd", "utf8"),
]);

if (!projectFile.includes("config_version=5")) {
  throw new Error("project.godot must declare config_version=5 (Godot 4.x)");
}
if (!projectFile.includes('run/main_scene="res://scenes/main.tscn"')) {
  throw new Error('project.godot must point run/main_scene to res://scenes/main.tscn');
}
if (!/config\/features=PackedStringArray\(.*"4\.3".*\)/.test(projectFile)) {
  throw new Error('project.godot must list "4.3" in config/features');
}

if (!exportPresets.includes('platform="Web"')) {
  throw new Error('export_presets.cfg must declare a Web platform preset');
}
if (!exportPresets.includes('export_path="exports/web/index.html"')) {
  throw new Error('export_presets.cfg Web preset must target exports/web/index.html');
}

if (!mainTscn.startsWith("[gd_scene")) {
  throw new Error("scenes/main.tscn must be a Godot scene file (starts with [gd_scene ...])");
}
if (!mainTscn.includes("scripts/main.gd")) {
  throw new Error("scenes/main.tscn must reference scripts/main.gd as a script resource");
}

if (!mainGd.includes("extends")) {
  throw new Error("scripts/main.gd must extend a Node type (e.g. `extends Node2D`)");
}
if (!/func\s+_ready\s*\(\s*\)/.test(mainGd)) {
  throw new Error("scripts/main.gd must implement _ready()");
}

console.log("godot-web starter ok");
