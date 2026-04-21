import rclpy
from rclpy.node import Node


class MyNode(Node):
    def __init__(self) -> None:
        super().__init__("my_ros2_node")
        self.get_logger().info("my_ros2_node started")


def main(args=None) -> None:
    rclpy.init(args=args)
    node = MyNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
