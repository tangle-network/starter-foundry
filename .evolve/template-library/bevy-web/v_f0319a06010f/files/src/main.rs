//! Minimal Bevy 0.14 app: DefaultPlugins, camera, light, rotating cube targeting WASM.

use bevy::prelude::*;

fn main() {
    // WASM panics are invisible on the canvas without this hook.
    #[cfg(target_arch = "wasm32")]
    console_error_panic_hook::set_once();

    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "bevy-web starter".into(),
                // Resizes the Bevy canvas to match the parent element — needed when the page owns layout.
                fit_canvas_to_parent: true,
                // Pass F11/ESC to the page instead of Bevy intercepting them.
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
    commands.spawn(Camera3dBundle {
        transform: Transform::from_xyz(2.5, 2.5, 4.0).looking_at(Vec3::ZERO, Vec3::Y),
        ..default()
    });

    commands.spawn(DirectionalLightBundle {
        directional_light: DirectionalLight {
            illuminance: 10_000.0,
            shadows_enabled: false,
            ..default()
        },
        transform: Transform::from_xyz(4.0, 8.0, 4.0).looking_at(Vec3::ZERO, Vec3::Y),
        ..default()
    });

    commands.insert_resource(AmbientLight {
        color: Color::WHITE,
        brightness: 0.25,
    });

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
    let dt = time.delta().as_secs_f32();
    for (mut transform, spinner) in &mut query {
        transform.rotate_y(spinner.speed * dt);
        transform.rotate_x(spinner.speed * 0.6 * dt);
    }
}
