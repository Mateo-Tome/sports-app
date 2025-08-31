import { Text, View } from 'react-native';

export default function indexScreen(){
  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center',  }}>
      <Text style={{color: 'red', fontSize: 24}}>Home screen</Text>
    </View>
  )
}