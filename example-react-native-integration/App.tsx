import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Button,
  Alert,
  TextInput,
} from 'react-native';

// Import the TAK library - should automatically use React Native transport
import TAK, { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

const App: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('https://tak-server.example.com:8443');
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [missions, setMissions] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testAPIConnection = async () => {
    try {
      addLog('Testing API connection...');
      
      // Mock certificate data for testing
      const mockCert = '-----BEGIN CERTIFICATE-----\nMOCK_CERT_DATA\n-----END CERTIFICATE-----';
      const mockKey = '-----BEGIN PRIVATE KEY-----\nMOCK_KEY_DATA\n-----END PRIVATE KEY-----';
      
      const api = await TAKAPI.init(
        new URL(serverUrl),
        new APIAuthCertificate(mockCert, mockKey)
      );
      
      // Test basic API call
      const missionList = await api.Mission.list({});
      setMissions(missionList.data || []);
      addLog(`API connection successful! Found ${missionList.data?.length || 0} missions`);
      
    } catch (error) {
      addLog(`API connection failed: ${error}`);
      Alert.alert('Connection Error', `Failed to connect: ${error}`);
    }
  };

  const testStreamingConnection = async () => {
    try {
      addLog('Testing streaming connection...');
      setConnectionStatus('Connecting...');
      
      // Mock certificate data for testing
      const mockAuth = {
        cert: '-----BEGIN CERTIFICATE-----\nMOCK_CERT_DATA\n-----END CERTIFICATE-----',
        key: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY_DATA\n-----END PRIVATE KEY-----'
      };
      
      const streamUrl = serverUrl.replace('8443', '8089').replace('https:', 'ssl:');
      const tak = await TAK.connect('test-connection', new URL(streamUrl), mockAuth);
      
      tak.on('cot', (cot) => {
        addLog(`Received CoT: ${cot.raw.event.$.type}`);
      }).on('connect', () => {
        setConnectionStatus('Connected');
        addLog('Streaming connection established');
      }).on('end', () => {
        setConnectionStatus('Disconnected');
        addLog('Streaming connection ended');
      }).on('error', (err) => {
        setConnectionStatus('Error');
        addLog(`Streaming error: ${err}`);
      });
      
    } catch (error) {
      setConnectionStatus('Error');
      addLog(`Streaming connection failed: ${error}`);
      Alert.alert('Connection Error', `Failed to connect: ${error}`);
    }
  };

  const testPlatformDetection = () => {
    addLog('Testing platform detection...');
    
    // Test that we're in React Native environment
    const isRN = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
    addLog(`Platform detected: ${isRN ? 'React Native' : 'Other'}`);
    
    // Test UUID generation
    if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
      const uuid = globalThis.crypto.randomUUID();
      addLog(`UUID generated: ${uuid}`);
    } else {
      addLog('UUID generation: Using fallback method');
    }
    
    // Test FormData availability
    if (typeof FormData !== 'undefined') {
      addLog('FormData: Available (global)');
    } else {
      addLog('FormData: Not available');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>TAK React Native Integration Test</Text>
          <Text style={styles.subtitle}>Status: {connectionStatus}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Server Configuration</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="TAK Server URL"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Tests</Text>
          <View style={styles.buttonRow}>
            <Button title="Test Platform" onPress={testPlatformDetection} />
            <Button title="Test API" onPress={testAPIConnection} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Test Streaming" onPress={testStreamingConnection} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Missions ({missions.length})</Text>
          {missions.slice(0, 3).map((mission, index) => (
            <Text key={index} style={styles.missionItem}>
              • {mission.name} - {mission.description || 'No description'}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logItem}>{log}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#2c3e50',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#ecf0f1',
    textAlign: 'center',
    marginTop: 5,
  },
  section: {
    margin: 15,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  input: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 5,
  },
  missionItem: {
    fontSize: 14,
    marginVertical: 2,
    color: '#34495e',
  },
  logItem: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginVertical: 1,
    color: '#7f8c8d',
  },
});

export default App;
