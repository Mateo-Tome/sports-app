import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View, } from 'react-native';

const sports = ["Wrestling", "Baseball", "Basketball", ];

export default function RecordingScreen(){
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const router = useRouter();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>

      <View 
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: "100%",
        justifyContent: 'space-between',
      }}
      >
      {sports.map((sport) => (
        <TouchableOpacity 
        key={sport} 
        onPress={() => {
          setSelectedSport(sport);
          if (sport === "Wrestling"){
            router.push("/screens/wrestlingselection");
          }
        }}

        style={{ 
          padding: 40,
          marginVertical: 15,
          borderWidth: 5,
          borderColor: "#ccc",
          borderRadius: 8,
          width: "50%",            
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: 'white',
           }}
           >
            <Text style={{ fontSize: 24, color: 'black'}}>
            {sport}
            </Text>

            </TouchableOpacity>

      ))}
    </View>
    </View>
  );
  
}



