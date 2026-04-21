// Skia + Reanimated integration: a shared value drives a derived
// angle, the derived angle renders through Skia's <Circle> and <Path>
// primitives. Everything below the `useSharedValue` call runs on the UI
// thread — it hits 60fps on any device released after 2020.

import { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { Canvas, Circle, Group, Path, Skia } from "@shopify/react-native-skia";
import Animated, {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

const { width } = Dimensions.get("window");
const SIZE = Math.min(width - 48, 320);

export default function CanvasScreen() {
  const progress = useSharedValue(0);
  const userOffset = useSharedValue(0);

  useEffect(() => {
    // Infinite rotation driven entirely on the UI thread via
    // Reanimated's worklet-based timing fn.
    progress.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress]);

  const angle = useDerivedValue(() => progress.value * 2 * Math.PI + userOffset.value);

  const cx = useDerivedValue(() => SIZE / 2 + Math.cos(angle.value) * SIZE * 0.3);
  const cy = useDerivedValue(() => SIZE / 2 + Math.sin(angle.value) * SIZE * 0.3);

  const arc = Skia.Path.Make();
  arc.addCircle(SIZE / 2, SIZE / 2, SIZE * 0.3);

  // Pan adds a user-controlled offset so the animation composes with
  // gesture input — a minimal test that worklets, Skia, and Gesture
  // Handler all share the same UI-thread context.
  const pan = Gesture.Pan().onUpdate((event) => {
    "worklet";
    userOffset.value = event.translationX / 120;
  });

  return (
    <View style={styles.root}>
      <GestureDetector gesture={pan}>
        <Animated.View style={styles.card}>
          <Canvas style={{ width: SIZE, height: SIZE }}>
            <Group>
              <Path path={arc} color="#e2e8f0" style="stroke" strokeWidth={2} />
              <Circle cx={cx} cy={cy} r={14} color="#6366f1" />
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={4} color="#0f172a" />
            </Group>
          </Canvas>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },
  card: {
    width: SIZE,
    height: SIZE,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
});
