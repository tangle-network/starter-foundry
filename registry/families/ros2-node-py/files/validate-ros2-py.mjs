import fs from "node:fs/promises";

// Hermetic validator — asserts the scaffold shape WITHOUT invoking colcon,
// rosdep, ament, or any ROS 2 binary. Consumers of this starter run
// colcon build themselves after sourcing /opt/ros/<distro>/setup.bash.

const [pkgXml, setupPy, setupCfg, pubSrc, subSrc, launchFile] = await Promise.all([
  fs.readFile("package.xml", "utf8"),
  fs.readFile("setup.py", "utf8"),
  fs.readFile("setup.cfg", "utf8"),
  fs.readFile("{{packageName}}/minimal_publisher.py", "utf8"),
  fs.readFile("{{packageName}}/minimal_subscriber.py", "utf8"),
  fs.readFile("launch/bringup.launch.py", "utf8"),
]);

// package.xml must declare ament_python + the rclpy/geometry/nav deps that
// match the source code's imports. If any are missing, `rosdep install`
// will fail on a fresh clone.
if (!pkgXml.includes("<build_type>ament_python</build_type>")) {
  throw new Error("package.xml missing ament_python build_type export");
}
for (const dep of ["rclpy", "std_msgs", "geometry_msgs", "sensor_msgs", "nav2_msgs"]) {
  if (!pkgXml.includes(`<depend>${dep}</depend>`)) {
    throw new Error(`package.xml missing <depend>${dep}</depend>`);
  }
}

// setup.py — entry_points are the ONLY path `ros2 run <pkg> <script>` uses
// for ament_python packages. Missing entry_points => silent no-op.
if (!setupPy.includes("entry_points")) {
  throw new Error("setup.py missing entry_points block");
}
if (!setupPy.includes("console_scripts")) {
  throw new Error("setup.py entry_points missing console_scripts");
}
if (!setupPy.includes("minimal_publisher:main") || !setupPy.includes("minimal_subscriber:main")) {
  throw new Error("setup.py console_scripts missing publisher/subscriber entry points");
}
if (!setupPy.includes("resource/")) {
  throw new Error("setup.py missing resource index registration in data_files");
}
if (!setupPy.includes("share/" + '"') && !setupPy.includes("share/\" + package_name")) {
  // Tolerate either templating style; just require the share/<pkg> path.
  if (!setupPy.includes("/launch")) {
    throw new Error("setup.py missing launch data_files install path");
  }
}

// setup.cfg — develop/install must point script_dir at lib/<pkg> so
// console_scripts land where ros2 run expects them.
if (!setupCfg.includes("script_dir") || !setupCfg.includes("install_scripts")) {
  throw new Error("setup.cfg missing script_dir / install_scripts overrides");
}

// minimal_publisher — must subclass rclpy.node.Node, construct a
// geometry_msgs/Twist publisher on /cmd_vel, and run a timer loop.
if (!pubSrc.includes("import rclpy")) {
  throw new Error("minimal_publisher.py does not import rclpy");
}
if (!pubSrc.includes("from rclpy.node import Node") && !pubSrc.includes("rclpy.node.Node")) {
  throw new Error("minimal_publisher.py does not import rclpy.node.Node");
}
if (!pubSrc.includes("Twist")) {
  throw new Error("minimal_publisher.py does not publish geometry_msgs/Twist");
}
if (!pubSrc.includes("create_publisher") || !pubSrc.includes("create_timer")) {
  throw new Error("minimal_publisher.py missing create_publisher / create_timer calls");
}
if (!pubSrc.includes("rclpy.init") || !pubSrc.includes("rclpy.spin") || !pubSrc.includes("rclpy.shutdown")) {
  throw new Error("minimal_publisher.py missing rclpy lifecycle (init/spin/shutdown)");
}

// minimal_subscriber — must subscribe to /odom with nav_msgs/Odometry.
if (!subSrc.includes("import rclpy")) {
  throw new Error("minimal_subscriber.py does not import rclpy");
}
if (!subSrc.includes("Odometry")) {
  throw new Error("minimal_subscriber.py does not subscribe to nav_msgs/Odometry");
}
if (!subSrc.includes("create_subscription")) {
  throw new Error("minimal_subscriber.py missing create_subscription call");
}

// launch file — must be valid Python launch description. Required by
// `ros2 launch <pkg> bringup.launch.py`.
if (!launchFile.includes("LaunchDescription")) {
  throw new Error("launch/bringup.launch.py does not define a LaunchDescription");
}
if (!launchFile.includes("Node(")) {
  throw new Error("launch/bringup.launch.py does not instantiate any launch_ros.actions.Node");
}
if (!launchFile.includes("generate_launch_description")) {
  throw new Error("launch/bringup.launch.py missing generate_launch_description() entrypoint");
}

console.log("ros2 python node ok");
