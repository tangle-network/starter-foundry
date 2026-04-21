"""Minimal rclpy subscriber node. Consumes nav_msgs/Odometry on /odom."""

from __future__ import annotations

import rclpy
from nav_msgs.msg import Odometry
from rclpy.node import Node


class MinimalSubscriber(Node):
    def __init__(self) -> None:
        super().__init__("minimal_subscriber")
        # queue depth 10 balances between dropping stale frames and holding
        # stale history. For high-frequency sensor streams, bump to 50+.
        self.subscription = self.create_subscription(Odometry, "odom", self._on_odom, 10)
        self.get_logger().info("minimal_subscriber up — listening on /odom")

    def _on_odom(self, msg: Odometry) -> None:
        pos = msg.pose.pose.position
        self.get_logger().info(f"odom: x={pos.x:.2f} y={pos.y:.2f} z={pos.z:.2f}")


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = MinimalSubscriber()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
