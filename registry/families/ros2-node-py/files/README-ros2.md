# {{serviceName}} — ROS2 rclpy node

Minimal ROS2 Python package with a publisher + subscriber demo, wired to a
colcon-buildable package layout. Targets Jazzy Jalisco (Ubuntu 24.04) with
Humble Hawksbill (Ubuntu 22.04) back-compat.

## Quickstart

Source your ROS2 distro first (e.g. `source /opt/ros/jazzy/setup.bash`).

```sh
# Drop this package into a colcon workspace:
mkdir -p ~/ros2_ws/src
cp -r . ~/ros2_ws/src/{{packageName}}
cd ~/ros2_ws
rosdep install --from-paths src --ignore-src -r -y
colcon build --packages-select {{packageName}}
source install/setup.bash

# Launch publisher + subscriber:
ros2 launch {{packageName}} bringup.launch.py
```

## Nodes

| Node | Topic | Direction | Msg type |
|---|---|---|---|
| `minimal_publisher` | `/cmd_vel` | publishes | `geometry_msgs/Twist` |
| `minimal_subscriber` | `/odom` | subscribes | `nav_msgs/Odometry` |

Publishing cadence: 2 Hz. Adjust the `create_timer` interval in
`{{packageName}}/minimal_publisher.py` for real drive loops (≥20 Hz typical).

## Gotchas

- **DDS domain ID**: if multiple ROS2 processes collide on the same network,
  set `ROS_DOMAIN_ID=<0-232>` so each project gets an isolated graph.
- **Overlay sourcing**: always `source install/setup.bash` _after_ `colcon build`
  in a fresh shell. Forgetting this is the #1 "why can't ros2 run find my
  package" error.
- **Message type mismatch**: `geometry_msgs/Twist` vs `geometry_msgs/msg/Twist`
  — the Python import path is `from geometry_msgs.msg import Twist`; the
  YAML `msg/` segment matters for cli tools + launch files.
- **Launch file discovery**: `ros2 launch {{packageName}} bringup.launch.py`
  requires the launch file to ship via `setup.py`'s `data_files` — verify
  `launch/bringup.launch.py` is listed.
