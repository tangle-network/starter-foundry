"""Minimal rclpy publisher node. Publishes geometry_msgs/Twist to /cmd_vel."""

from __future__ import annotations

import rclpy
from geometry_msgs.msg import Twist
from rclpy.node import Node


class MinimalPublisher(Node):
    def __init__(self) -> None:
        super().__init__("minimal_publisher")
        # QoS of depth=10 keeps a small outbound buffer without unbounded growth.
        self.publisher = self.create_publisher(Twist, "cmd_vel", 10)
        # Publish at 2 Hz — tune per product (real drive loops target ≥20 Hz).
        self.create_timer(0.5, self._tick)
        self._i = 0
        self.get_logger().info("minimal_publisher up — publishing /cmd_vel at 2 Hz")

    def _tick(self) -> None:
        msg = Twist()
        msg.linear.x = 0.1
        msg.angular.z = 0.2
        self.publisher.publish(msg)
        self._i += 1
        if self._i % 10 == 0:
            self.get_logger().info(f"published {self._i} Twist messages")


def main(args: list[str] | None = None) -> None:
    rclpy.init(args=args)
    node = MinimalPublisher()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
