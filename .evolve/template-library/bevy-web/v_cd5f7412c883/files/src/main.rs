//! Minimal Bevy 0.14 app targeting the web via WASM.
//!
//! Spawns a camera, a directional light, and a rotating cube. A system
//! rotates the cube each frame so the scene is visibly alive. Replace
//! the cube with real geometry, add input + audio plugins, and grow
//! from here.

use bevy::prelude::*;

fn main() {
    // Install a panic hook that forwards Rust panics to the browser
    // console — without this, WASM panics are invisible and the canvas
    // just freezes silently.
    #[cfg(target_arch = "wasm32")]
    console_error_panic_hook::set_once();

    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "bevy-web starter".into(),
                // `fit_canvas_to_parent` makes Bevy resize its canvas to
                // match the parent element — required when the page
                // owns layout instead of Bevy.
                fit_canvas_to_parent: true,
                // Let the page handle F11/ESC instead of Bevy hijacking
                // them; avoids surprises in embedded contexts.
                prevent_default_event_handling: false,
                ..default()
            }),
            ..default()
        }))
        .add_systems(Startup, setup)
        .add_systems(Update, rotate_cubes)
        .run();
}

#[derive(Component)]
struct Spinner {
    speed: f32,
}

fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    // Camera pulled back and tilted down so the cube is framed.
    commands.spawn(Camera3dBundle {
        transform: Transform::from_xyz(2.5, 2.5, 4.0).looking_at(Vec3::ZERO, Vec3::Y),
        ..default()
    });

    // One directional light — cheapest lighting that still shows faces.
    commands.spawn(DirectionalLightBundle {
        directional_light: DirectionalLight {
            illuminance: 10_000.0,
            shadows_enabled: false,
            ..default()
        },
        transform: Transform::from_xyz(4.0, 8.0, 4.0).looking_at(Vec3::ZERO, Vec3::Y),
        ..default()
    });

    // Ambient so the back faces aren't pure black.
    commands.insert_resource(AmbientLight {
        color: Color::WHITE,
        brightness: 0.25,
    });

    // The cube itself.
    commands.spawn((
        PbrBundle {
            mesh: meshes.add(Cuboid::new(1.0, 1.0, 1.0)),
            material: materials.add(StandardMaterial {
                base_color: Color::srgb(0.43, 0.66, 1.0),
                perceptual_roughness: 0.35,
                metallic: 0.1,
                ..default()
            }),
            transform: Transform::from_xyz(0.0, 0.0, 0.0),
            ..default()
        },
        Spinner { speed: 0.9 },
    ));
}

fn rotate_cubes(time: Res<Time>, mut query: Query<(&mut Transform, &Spinner)>) {
    let dt = time.delta_seconds();
    for (mut transform, spinner) in &mut query {
        transform.rotate_y(spinner.speed * dt);
        transform.rotate_x(spinner.speed * 0.6 * dt);
    }
}
