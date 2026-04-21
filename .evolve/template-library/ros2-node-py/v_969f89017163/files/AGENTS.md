# {{packageName}} — ROS 2 Python Node

## What this scaffold gives you

| File | Purpose |
|---|---|
| `{{packageName}}/my_node.py` | Minimal rclpy node — start here for custom robot logic |
| `{{packageName}}/minimal_publisher.py` | Publishes `geometry_msgs/Twist` to `/cmd_vel` at 2 Hz |
| `{{packageName}}/minimal_subscriber.py` | Subscribes to `nav_msgs/Odometry` on `/odom` |
| `launch/bringup.launch.py` | Launches publisher + subscriber as separate processes |
| `setup.py` | ament_python build config — entry_points wire `ros2 run` |
| `package.xml` | ROS 2 package manifest with all message dependencies |

## Build & run (requires ROS 2 Jazzy or Humble)

```sh
# 1. Source the ROS 2 overlay — rclpy is NOT pip-installable
source /opt/ros/jazzy/setup.bash        # or humble on Ubuntu 22.04

# 2. Place at src/{{packageName}} inside a colcon workspace
mkdir -p ~/ros2_ws/src
cp -r . ~/ros2_ws/src/{{packageName}}
cd ~/ros2_ws

# 3. Build and overlay
colcon build --packages-select {{packageName}}
source install/setup.bash               # must re-source after every build

# 4. Run
ros2 run {{packageName}} my_node        # minimal node (extend for your logic)
ros2 run {{packageName}} publisher      # Twist publisher on /cmd_vel
ros2 run {{packageName}} subscriber     # Odometry subscriber on /odom
ros2 launch {{packageName}} bringup.launch.py   # publisher + subscriber together
```

## Template variables

| Variable | Default | What it controls |
|---|---|---|
| `{{packageName}}` | `starter_foundry_ros2` | ROS package name, Python module name, and directory name |
| `{{rosDistro}}` | `jazzy` | ROS 2 distribution (`jazzy` = Ubuntu 24.04, `humble` = Ubuntu 22.04) |

## Key extension points

- **Custom node logic** — edit `{{packageName}}/my_node.py`; add `create_publisher`, `create_subscription`, `create_timer` calls in `__init__`
- **Change publish rate** — in `minimal_publisher.py`, change `create_timer(0.5, ...)` (value in seconds, so 0.05 = 20 Hz)
- **Add a ROS service** — `self.create_service(SrvType, 'name', callback)` in any Node subclass
- **Nav2 lifecycle** — inherit from `rclpy.lifecycle.LifecycleNode`; wire `on_configure` / `on_activate`
- **Add launch nodes** — append `Node(package=..., executable=...)` actions to `launch/bringup.launch.py`
- **New message types** — add `<depend>...</depend>` in `package.xml` and import from the `.msg` subpackage

## Critical gotchas

- **Always re-source** `install/setup.bash` after every `colcon build` — ROS overlays don't chain automatically. This is the #1 cause of "package not found" errors.
- **entry_points is the only discovery mechanism** — `ros2 run <pkg> <script>` finds executables exclusively through `setup.py`'s `console_scripts`. A missing or misspelled entry means a silent "No executable found" error.
- **`resource/{{packageName}}`** is a mandatory empty marker file — deleting it breaks `ros2 pkg list` and makes the package invisible to the ROS graph.
- **Set `ROS_DOMAIN_ID`** (1–232) per workstation on any shared network to prevent topic collisions with other developers.
- **Launch file discovery** — `ros2 launch` finds `bringup.launch.py` only because `setup.py`'s `data_files` maps `launch/bringup.launch.py` into `share/{{packageName}}/launch/`. If you add launch files, add them to `data_files` too.
