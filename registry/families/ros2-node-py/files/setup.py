from setuptools import find_packages, setup

package_name = "{{packageName}}"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        # ament index registration — required for `ros2 pkg list` to find this package.
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        # package.xml must be installed so rosdep / rcl can read it.
        ("share/" + package_name, ["package.xml"]),
        # Launch files — installed under share/<pkg>/launch so `ros2 launch <pkg> ...` works.
        ("share/" + package_name + "/launch", ["launch/bringup.launch.py"]),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="starter-foundry",
    maintainer_email="dev@example.com",
    description="{{packageName}} — minimal ROS 2 Python node (cmd_vel publisher + /odom subscriber).",
    license="Apache-2.0",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            # ros2 run {{packageName}} publisher
            "publisher = {{packageName}}.minimal_publisher:main",
            # ros2 run {{packageName}} subscriber
            "subscriber = {{packageName}}.minimal_subscriber:main",
        ],
    },
)
