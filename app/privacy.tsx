import { ScrollView, Text } from "react-native";

export default function Privacy() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "black", padding: 20 }}>
      <Text style={{ color: "white", fontSize: 28, fontWeight: "800", marginBottom: 16 }}>
        Privacy Policy
      </Text>

      <Text style={{ color: "white", opacity: 0.8, marginBottom: 12 }}>
        QuickClip Sport collects email addresses for authentication using Firebase Authentication.
      </Text>

      <Text style={{ color: "white", opacity: 0.8, marginBottom: 12 }}>
        User content such as videos and photos may be stored securely using cloud storage providers for playback and sharing features.
      </Text>

      <Text style={{ color: "white", opacity: 0.8, marginBottom: 12 }}>
        We do not sell, trade, or rent personal information to third parties.
      </Text>

      <Text style={{ color: "white", opacity: 0.8, marginBottom: 12 }}>
        Users may request account deletion by contacting support.
      </Text>

      <Text style={{ color: "white", opacity: 0.8 }}>
        Contact: support@quickclipapp.com
      </Text>
    </ScrollView>
  );
}