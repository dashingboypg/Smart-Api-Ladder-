// App.js — Ready-to-Go Ladder Strategy (production-capable)
// NOTE: This will place live orders when you use Run Ladder and are logged in.
// Use small quantities when testing.

import React, { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, TextInput, Button, View, Alert, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import { authenticator } from "otplib";

const SMARTAPI_BASE = "https://apiconnect.angelbroking.com"; // change if needed

function generateBuyLadder(cmp, step, steps, multiplier = 1) {
  const ladder = [];
  for (let i = 0; i < steps; i++) {
    ladder.push({ qty: (i + 1) * multiplier, price: Math.round((cmp - i * step) * 100) / 100 });
  }
  return ladder;
}

export default function App() {
  const [tradingKey, setTradingKey] = useState("");
  const [marketKey, setMarketKey] = useState("");
  const [historicalKey, setHistoricalKey] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [mpin, setMpin] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totp, setTotp] = useState("");
  const [sessionToken, setSessionToken] = useState(null);

  const [symbol, setSymbol] = useState("RELIANCE");
  const [symbolToken, setSymbolToken] = useState("");
  const [cmp, setCmp] = useState("0");
  const [stepSize, setStepSize] = useState("20");
  const [steps, setSteps] = useState("4");
  const [multiplier, setMultiplier] = useState("1");
  const [useGTT, setUseGTT] = useState(true);

  const [log, setLog] = useState([]);

  useEffect(() => {
    if (totpSecret) {
      const timer = setInterval(() => {
        try {
          setTotp(authenticator.generate(totpSecret));
        } catch (e) {
          // invalid secret
        }
      }, 10000);
      return () => clearInterval(timer);
    }
  }, [totpSecret]);

  function appendLog(msg) {
    setLog(l => [new Date().toISOString() + " - " + msg, ...l].slice(0, 200));
  }

  async function saveSecrets() {
    const payload = { tradingKey, marketKey, historicalKey, clientCode, mpin, totpSecret };
    await SecureStore.setItemAsync("ladder_secrets_v1", JSON.stringify(payload));
    Alert.alert("Saved", "Credentials saved securely on device");
  }

  async function loadSecrets() {
    const v = await SecureStore.getItemAsync("ladder_secrets_v1");
    if (v) {
      const p = JSON.parse(v);
      setTradingKey(p.tradingKey || "");
      setMarketKey(p.marketKey || "");
      setHistoricalKey(p.historicalKey || "");
      setClientCode(p.clientCode || "");
      setMpin(p.mpin || "");
      setTotpSecret(p.totpSecret || "");
      Alert.alert("Loaded", "Credentials loaded from secure storage");
    } else {
      Alert.alert("Empty", "No saved credentials found");
    }
  }

  async function login() {
    if (!tradingKey || !clientCode || !mpin) return Alert.alert("Missing", "Trading key, client code and MPIN required");
    appendLog("Logging in...");
    try {
      const resp = await fetch(SMARTAPI_BASE + "/rest/auth/angelbroking/user/v1/loginByPassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientcode: clientCode, password: mpin, totp, apikey: tradingKey })
      });
      const data = await resp.json();
      appendLog("Login resp: " + JSON.stringify(data));
      const t = data?.data?.jwtToken || data?.jwtToken || data?.token;
      if (t) { setSessionToken(t); Alert.alert("Login OK"); } else { Alert.alert("Login failed"); }
    } catch (e) {
      appendLog("Login error: " + e.message);
      Alert.alert("Login error", e.message);
    }
  }

  // Fetch latest price using marketKey — endpoint paths can differ; verify with Angel docs.
  async function fetchCMP() {
    if (!marketKey) { Alert.alert("Missing", "Market Key required to fetch price"); return; }
    try {
      // NOTE: some SmartAPI accounts expose quote endpoints — confirm path with Angel docs.
      const url = `${SMARTAPI_BASE}/rest/secure/angelbroking/order/v1/searchScrip?scrip=${encodeURIComponent(symbol)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${marketKey}` } });
      const d = await r.json();
      appendLog("CMP fetch resp: " + JSON.stringify(d));
      if (d?.data?.length > 0) {
        const item = d.data[0];
        setCmp(String(item.ltp || item.lastPrice || item.last_traded_price || 0));
        setSymbolToken(item.symboltoken || item.instrument_token || item.token || "");
        appendLog(`Set CMP ${item.ltp || item.lastPrice}`);
      } else {
        Alert.alert("Not found", "No price returned for symbol");
      }
    } catch (e) {
      appendLog("CMP error " + e.message);
    }
  }

  async function runLadder() {
    if (!sessionToken) return Alert.alert("Login required");
    const cmpN = Number(cmp), stepN = Number(stepSize), stepsN = Number(steps), mult = Number(multiplier);
    if (!Number.isFinite(cmpN) || !Number.isFinite(stepN) || !Number.isInteger(stepsN)) return Alert.alert("Invalid params");
    const ladder = generateBuyLadder(cmpN, stepN, stepsN, mult);
    appendLog("Generated ladder: " + JSON.stringify(ladder));
    for (const s of ladder) {
      if (useGTT) {
        const payload = { tradingsymbol: symbol, symboltoken: symbolToken, exchange: "NSE", producttype: "DELIVERY", transactiontype: "BUY", price: s.price, qty: s.qty, timeperiod: 365 };
        appendLog("Creating GTT: " + JSON.stringify(payload));
        try {
          const r = await fetch(SMARTAPI_BASE + "/rest/secure/angelbroking/gtt/v1/createRule", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
            body: JSON.stringify(payload)
          });
          const d = await r.json();
          appendLog("GTT resp: " + JSON.stringify(d));
        } catch (e) { appendLog("GTT error: " + e.message); }
      } else {
        const order = { variety: "NORMAL", tradingsymbol: symbol, symboltoken: symbolToken, transactiontype: "BUY", exchange: "NSE", ordertype: "LIMIT", producttype: "DELIVERY", duration: "DAY", price: s.price, quantity: s.qty };
        appendLog("Placing order: " + JSON.stringify(order));
        try {
          const r = await fetch(SMARTAPI_BASE + "/rest/secure/angelbroking/order/v1/placeOrder", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
            body: JSON.stringify(order)
          });
          const d = await r.json();
          appendLog("Order resp: " + JSON.stringify(d));
        } catch (e) { appendLog("Order error: " + e.message); }
      }
    }
    Alert.alert("Done", "Ladder submissions complete — check log");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#071029" }}>
      <ScrollView style={{ padding: 12 }}>
        <Text style={styles.h}>Ladder Strategy — Ready App</Text>

        <View style={styles.card}>
          <Text style={styles.label}>API Keys</Text>
          <TextInput placeholder="Trading Key" style={styles.input} value={tradingKey} onChangeText={setTradingKey} />
          <TextInput placeholder="Market Key" style={styles.input} value={marketKey} onChangeText={setMarketKey} />
          <TextInput placeholder="Historical Key" style={styles.input} value={historicalKey} onChangeText={setHistoricalKey} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Login</Text>
          <TextInput placeholder="Client Code" style={styles.input} value={clientCode} onChangeText={setClientCode} />
          <TextInput placeholder="MPIN" secureTextEntry style={styles.input} value={mpin} onChangeText={setMpin} />
          <TextInput placeholder="TOTP Secret (optional)" style={styles.input} value={totpSecret} onChangeText={setTotpSecret} />
          <TextInput placeholder="TOTP (auto if secret)" style={styles.input} value={totp} onChangeText={setTotp} />
          <Button title="Save credentials" onPress={saveSecrets} />
          <Button title="Load credentials" onPress={loadSecrets} />
          <Button title="Login" onPress={login} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Ladder</Text>
          <TextInput placeholder="Tradingsymbol" style={styles.input} value={symbol} onChangeText={setSymbol} />
          <Button title="Fetch CMP (market key)" onPress={fetchCMP} />
          <Text style={{ color: "#cbd5e1", marginTop: 6 }}>CMP: {cmp}</Text>
          <TextInput placeholder="Step Size" style={styles.input} value={stepSize} onChangeText={setStepSize} />
          <TextInput placeholder="Steps" style={styles.input} value={steps} onChangeText={setSteps} />
          <TextInput placeholder="Quantity multiplier" style={styles.input} value={multiplier} onChangeText={setMultiplier} />
          <Button title={useGTT ? "GTT MODE" : "LIVE ORDER MODE"} onPress={() => setUseGTT(s => !s)} />
          <Button title="Run Ladder (LIVE)" onPress={runLadder} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Log</Text>
          {log.map((l, i) => <Text key={i} style={{ color: "#9fb3d6", fontSize: 11 }}>{l}</Text>)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#0b1220", padding: 10, marginBottom: 10, borderRadius: 8 },
  input: { backgroundColor: "#071626", color: "white", padding: 8, marginVertical: 6, borderRadius: 6 },
  label: { color: "#cbd5e1", marginBottom: 6, fontWeight: "600" },
  h: { color: "#e6eef8", fontSize: 20, marginBottom: 10 }
});
