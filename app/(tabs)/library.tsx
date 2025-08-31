import React from 'react';
import { Text, View } from 'react-native';

export default function library(){
    return(
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Text style={{color: 'red', fontSize: 24}}>Library</Text>
    </View>
    );
}