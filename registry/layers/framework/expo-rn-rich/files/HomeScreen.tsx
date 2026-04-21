import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
        backgroundColor: "#ffffff",
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 6 }}>{title}</Text>
      <Text style={{ color: "#4b5563" }}>{body}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f3f4f6" }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 26, fontWeight: "700", color: "#111827" }}>{{headline}}</Text>
      <Text style={{ fontSize: 15, color: "#4b5563", marginTop: 4 }}>{{subheadline}}</Text>
      <Section
        title="Navigation"
        body="Native Stack wraps Bottom Tabs — tap the Canvas tab to see Skia + Reanimated drive a worklet."
      />
      <Section title="Auth" body="Wire sign-in flows here." />
      <Section title="Payments" body="Attach premium purchase flows here." />
    </ScrollView>
  );
}
