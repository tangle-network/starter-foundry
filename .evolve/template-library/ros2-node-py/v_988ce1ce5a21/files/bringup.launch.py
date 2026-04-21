"""ROS2 launch file bringing up publisher + subscriber as a single process."""

from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription(
        [
            Node(
                package="{{packageName}}",
                executable="minimal_publisher",
                name="minimal_publisher",
                output="screen",
            ),
            Node(
                package="{{packageName}}",
                executable="minimal_subscriber",
                name="minimal_subscriber",
                output="screen",
            ),
        ]
    )
