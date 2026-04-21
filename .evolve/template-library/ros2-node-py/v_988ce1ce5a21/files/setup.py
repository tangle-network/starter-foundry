from setuptools import find_packages, setup

package_name = "{{packageName}}"

setup(
    name=package_name,
    version="0.1.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
        ("share/" + package_name + "/launch", ["launch/bringup.launch.py"]),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="starter-foundry",
    maintainer_email="dev@example.com",
    description="{{packageName}} — ROS 2 Python node (cmd_vel publisher + /odom subscriber + minimal node).",
    license="Apache-2.0",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "my_node = {{packageName}}.my_node:main",
            "publisher = {{packageName}}.minimal_publisher:main",
            "subscriber = {{packageName}}.minimal_subscriber:main",
        ],
    },
)
