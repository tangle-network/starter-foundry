extends Node2D

# Main scene root. _ready runs once when the scene enters the tree;
# _process runs every frame with the frame delta. Replace the body of
# both with real game logic as the project grows.

@onready var _sprite: Sprite2D = $Sprite2D
@onready var _label: Label = $Label

var _elapsed: float = 0.0

func _ready() -> void:
	# Surface engine + renderer info so web exports are diagnosable when
	# something blanks out. Log shows up in the browser devtools console.
	var version := Engine.get_version_info()
	var renderer := RenderingServer.get_rendering_device() != null
	print("godot-web ready · %s · rendering_device=%s" % [version.string, renderer])

	# On web, a SharedArrayBuffer failure presents as everything loading
	# but no rendering happening. If that's the symptom, check COOP/COEP
	# headers on the serving host.

func _process(delta: float) -> void:
	_elapsed += delta
	# Gentle spin so the scene is visibly alive.
	_sprite.rotation = _elapsed * 0.6
	# Breathe the scale between 0.9x and 1.1x.
	var s := 1.0 + sin(_elapsed * 2.0) * 0.1
	_sprite.scale = Vector2(s, s)
