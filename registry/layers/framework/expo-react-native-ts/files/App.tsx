import { SafeAreaView, Text, View } from "react-native";

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
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>{title}</Text>
      <Text style={{ color: "#4b5563" }}>{body}</Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#f3f4f6",
        padding: 24,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "700", color: "#111827", marginBottom: 12 }}>{{headline}}</Text>
      <Text style={{ fontSize: 16, color: "#4b5563" }}>{{subheadline}}</Text>
      <Section title="Auth" body="Wire sign-in and account recovery flows here." />
      <Section title="Payments" body="Attach premium purchase or subscription screens here." />
      <Section title="Wallet" body="Connect mobile wallet or partner SDK flows here." />
    </SafeAreaView>
  );
}
