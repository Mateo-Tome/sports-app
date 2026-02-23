import { ScrollView, Text } from "react-native";

export default function Terms() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "black", padding: 20 }}>
      <Text style={{ color: "white", fontSize: 28, fontWeight: "800", marginBottom: 16 }}>
        Terms of Service
      </Text>

      <Text style={{ color: "white", opacity: 0.8, marginBottom: 12 }}>
        By using QuickClip, you agree to use the app responsibly and only upload content you have rights to share.
      </Text>

      <Text style={{ color: "white", opacity: 0.8 }}>
        QuickClip is provided “as is” without warranties.
      </Text>
    </ScrollView>
  );
}