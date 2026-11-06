import React, { useState, useEffect, useCallback } from "react";
import { Text, View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {
  RACES, PELAGES, SURFACES, VULNERABILITE,
  groundTemp, evaluate, fetchLiveWeather,
} from "./utils/logic";

const Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "#f8fafc", primary: "#0f172a" },
};
const Tab = createBottomTabNavigator();
const DEFAULT_PROFIL = { nom: "Rex", race: "moyen", pelage: "normal", vuln: "adulte" };
const DEFAULT_METEO = { air: 31, soleil: "fort", vent: "faible", surface: "asphalte" };

export default function App() {
  const [profil, setProfil] = useState(DEFAULT_PROFIL);
  const [meteo, setMeteo] = useState(DEFAULT_METEO);
  const [live, setLive] = useState(null);
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Charger les données locales avant de démarrer leur sauvegarde.
  useEffect(() => {
    (async () => {
      try {
        const [savedProfil, savedHistory] = await Promise.all([
          AsyncStorage.getItem("profil"),
          AsyncStorage.getItem("history"),
        ]);
        if (savedProfil) setProfil({ ...DEFAULT_PROFIL, ...JSON.parse(savedProfil) });
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory);
          if (Array.isArray(parsed)) setHistory(parsed);
        }
      } catch {
        // Les données locales invalides ne doivent pas empêcher l'ouverture de l'app.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("profil", JSON.stringify(profil)).catch(() => {});
  }, [profil, loaded]);

  const enregistrerSortie = useCallback((entree) => {
    setHistory((h) => {
      const next = [entree, ...h].slice(0, 30);
      AsyncStorage.setItem("history", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <NavigationContainer theme={Theme}>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#fff",
          tabBarActiveTintColor: "#0f172a",
          tabBarLabelStyle: { fontSize: 10 },
        }}
      >
        <Tab.Screen name="Résultat" options={{ tabBarIcon: () => <Text>🌡️</Text> }}>
          {() => <ResultatScreen profil={profil} meteo={meteo} onEnregistrer={enregistrerSortie} />}
        </Tab.Screen>
        <Tab.Screen name="Prévisions" options={{ tabBarIcon: () => <Text>⏰</Text> }}>
          {() => <PrevisionsScreen profil={profil} meteo={meteo} live={live} />}
        </Tab.Screen>
        <Tab.Screen name="Historique" options={{ tabBarIcon: () => <Text>📓</Text> }}>
          {() => <HistoriqueScreen history={history} />}
        </Tab.Screen>
        <Tab.Screen name="Mon chien" options={{ tabBarIcon: () => <Text>🐕</Text> }}>
          {() => <ChienScreen profil={profil} setProfil={setProfil} />}
        </Tab.Screen>
        <Tab.Screen name="Météo" options={{ tabBarIcon: () => <Text>☀️</Text> }}>
          {() => <MeteoScreen meteo={meteo} setMeteo={setMeteo} setLive={setLive} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// ---------- Helpers ----------
const marge = (p) =>
  (RACES[p.race] ?? RACES.moyen).marge +
  (PELAGES[p.pelage] ?? PELAGES.normal).marge +
  (VULNERABILITE[p.vuln] ?? VULNERABILITE.adulte).marge;

function Card({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Choice({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceText, active && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------- Écran Résultat ----------
function ResultatScreen({ profil, meteo, onEnregistrer }) {
  const heure = new Date().getHours();
  const ground = groundTemp(meteo.air, meteo.surface, meteo.soleil, meteo.vent, heure);
  const res = evaluate(ground, marge(profil));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.bigCard, { alignItems: "center" }]}>
        <Text style={styles.eyebrow}>TEMPÉRATURE ESTIMÉE DU SOL</Text>
        <Text style={{ fontSize: 42, fontWeight: "800", color: "#0f172a" }}>{ground.toFixed(1)}°C</Text>
        <View style={[styles.badge, { backgroundColor: res.couleur }]}>
          <Text style={styles.badgeText}>{res.icone} {res.titre}</Text>
        </View>
        <Text style={styles.sub}>
          Air {meteo.air}°C · {SURFACES[meteo.surface].label} · {heure}h
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => onEnregistrer({
            date: new Date().toLocaleString("fr-FR"),
            nom: profil.nom, air: meteo.air,
            surface: SURFACES[meteo.surface].label,
            sol: ground, verdict: res.titre,
          })}
        >
          <Text style={styles.buttonText}>📓 Enregistrer cette sortie</Text>
        </TouchableOpacity>
      </View>

      <Card title="Recommandations">
        {res.conseils.map((c, i) => <Text key={i} style={styles.li}>• {c}</Text>)}
      </Card>

      <Card title="Comparatif des surfaces maintenant">
        {Object.entries(SURFACES).map(([k, sf]) => {
          const g = groundTemp(meteo.air, k, meteo.soleil, meteo.vent, heure);
          const r = evaluate(g, marge(profil));
          return (
            <View key={k} style={styles.row}>
              <Text style={styles.li}>{sf.label}</Text>
              <Text style={{ color: r.couleur, fontWeight: "700" }}>{g.toFixed(1)}°C {r.icone}</Text>
            </View>
          );
        })}
      </Card>
      <Text style={styles.disclaimer}>Estimation indicative : vérifiez toujours la température du sol avec votre main et surveillez votre chien.</Text>
    </ScrollView>
  );
}

// ---------- Écran Prévisions ----------
function PrevisionsScreen({ profil, meteo, live }) {
  const m = marge(profil);
  const heures = (live?.hourly ?? []).slice(0, 14);
  const data = heures.length
    ? heures.map((h) => ({ heure: h.heure, air: h.air, g: groundTemp(h.air, meteo.surface, h.soleil, h.vent, h.heure) }))
    : Array.from({ length: 14 }, (_, i) => {
        const h = (new Date().getHours() + i) % 24;
        const delta = h >= 11 && h <= 16 ? 3 : h >= 19 || h <= 6 ? -4 : 0;
        const a = meteo.air + delta;
        return { heure: h, air: a, g: groundTemp(a, meteo.surface, meteo.soleil, meteo.vent, h) };
      });

  const surs = data.filter((p) => ["ok", "froid"].includes(evaluate(p.g, m).niveau));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!live && (
        <View style={styles.infoBox}>
          <Text style={{ color: "#0369a1", fontSize: 12 }}>
            ⏰ Mode simulation. Activez la météo en direct dans l'onglet ☀️ pour des prévisions réelles.
          </Text>
        </View>
      )}
      {!!live && <View style={styles.infoBox}><Text style={{ color: "#0369a1", fontSize: 12 }}>Prévisions météo en direct · {live.source}</Text></View>}
      <View style={[styles.infoBox, { backgroundColor: surs.length ? "#f0fdf4" : "#fff1f2", borderColor: surs.length ? "#bbf7d0" : "#fecdd3" }]}>
        <Text style={{ color: surs.length ? "#166534" : "#9f1239", fontSize: 12, fontWeight: "600" }}>
          {surs.length
            ? `✅ Créneaux conseillés : ${surs.map((f) => String(f.heure).padStart(2, "0") + "h").join(", ")}`
            : "🚫 Aucun créneau conseillé dans les prochaines heures. Essayez l'herbe ou attendez que le sol refroidisse."}
        </Text>
      </View>
      <Card title="Prochaines heures">
        {data.map((p, i) => {
          const r = evaluate(p.g, m);
          return (
            <View key={i} style={[styles.row, styles.forecastRow]}>
              <Text style={{ fontWeight: "600" }}>{String(p.heure).padStart(2, "0")}h</Text>
              <Text style={{ color: "#64748b" }}>air {p.air.toFixed(0)}°C</Text>
              <Text style={{ color: r.couleur, fontWeight: "700" }}>sol {p.g.toFixed(1)}°C {r.icone}</Text>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

// ---------- Écran Historique ----------
function HistoriqueScreen({ history }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card title="Sorties enregistrées">
        {history.length === 0 ? (
          <Text style={styles.sub}>Aucune sortie enregistrée pour le moment.</Text>
        ) : history.map((e, i) => (
          <View key={`${e.date}-${i}`} style={[styles.row, { marginBottom: 8, gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", fontSize: 13 }}>{e.date} · {e.nom}</Text>
              <Text style={{ color: "#94a3b8", fontSize: 11 }}>air {e.air}°C · {e.surface}</Text>
            </View>
            <Text style={{ fontWeight: "700", textAlign: "right" }}>{Number(e.sol).toFixed(1)}°C · {e.verdict}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

// ---------- Écran Mon chien ----------
function ChienScreen({ profil, setProfil }) {
  const up = (k, v) => setProfil((p) => ({ ...p, [k]: v }));
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card title="Profil">
        <Text style={styles.sub}>Seuil indicatif ajusté : {(45 + marge(profil)).toFixed(1)}°C (référence : 45°C)</Text>
      </Card>
      <Card title="Taille / race">
        {Object.entries(RACES).map(([k, r]) => <Choice key={k} label={`${r.label} · ${r.poids}`} active={profil.race === k} onPress={() => up("race", k)} />)}
      </Card>
      <Card title="Pelage">
        {Object.entries(PELAGES).map(([k, p]) => <Choice key={k} label={p.label} active={profil.pelage === k} onPress={() => up("pelage", k)} />)}
      </Card>
      <Card title="Sensibilité">
        {Object.entries(VULNERABILITE).map(([k, v]) => <Choice key={k} label={v.label} active={profil.vuln === k} onPress={() => up("vuln", k)} />)}
      </Card>
      <Text style={styles.disclaimer}>Les sensibilités varient d'un chien à l'autre. En cas de doute, demandez conseil à un vétérinaire.</Text>
    </ScrollView>
  );
}

// ---------- Écran Météo ----------
function MeteoScreen({ meteo, setMeteo, setLive }) {
  const [status, setStatus] = useState("idle");
  const [msg, setMsg] = useState("");

  const getLive = async () => {
    try {
      setStatus("loading");
      setMsg("");
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== "granted") {
        setStatus("error");
        setMsg("Position refusée ; réglez la météo manuellement.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const w = await fetchLiveWeather(pos.coords.latitude, pos.coords.longitude);
      setLive(w);
      setMeteo((m) => ({ ...m, air: Math.round(w.air), soleil: w.soleil, vent: w.vent }));
      setStatus("ok");
      setMsg(`Météo en direct : ${Math.round(w.air)}°C.`);
    } catch {
      setStatus("error");
      setMsg("Météo indisponible ; vérifiez la connexion ou réglez-la manuellement.");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card title="Météo en direct">
        <Text style={styles.sub}>La position sert uniquement à demander la météo locale.</Text>
        <TouchableOpacity style={[styles.button, status === "loading" && { opacity: 0.6 }]} onPress={getLive} disabled={status === "loading"}>
          <Text style={styles.buttonText}>{status === "loading" ? "Localisation…" : "📍 Utiliser ma position et la météo réelle"}</Text>
        </TouchableOpacity>
        {msg ? <Text style={[styles.sub, { marginTop: 8, color: status === "error" ? "#b91c1c" : "#475569" }]}>{msg}</Text> : null}
      </Card>
      <Card title={`Température de l'air : ${meteo.air}°C`}>
        <View style={styles.options}>
          {[-5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45].map((t) => <Choice key={t} label={`${t}°`} active={meteo.air === t} onPress={() => setMeteo((m) => ({ ...m, air: t }))} />)}
        </View>
      </Card>
      <Card title="Ensoleillement">
        <View style={styles.options}>{[["faible", "Faible"], ["modere", "Modéré"], ["fort", "Fort"]].map(([k, label]) => <Choice key={k} label={label} active={meteo.soleil === k} onPress={() => setMeteo((m) => ({ ...m, soleil: k }))} />)}</View>
      </Card>
      <Card title="Vent">
        <View style={styles.options}>{[["faible", "Faible"], ["modere", "Modéré"], ["fort", "Fort"]].map(([k, label]) => <Choice key={k} label={label} active={meteo.vent === k} onPress={() => setMeteo((m) => ({ ...m, vent: k }))} />)}</View>
      </Card>
      <Card title="Surface où vous marchez">
        {Object.entries(SURFACES).map(([k, sf]) => <Choice key={k} label={sf.label} active={meteo.surface === k} onPress={() => setMeteo((m) => ({ ...m, surface: k }))} />)}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#f1f5f9" },
  cardTitle: { fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 8 },
  bigCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#f1f5f9", gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: "#64748b" },
  badge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  badgeText: { color: "#fff", fontWeight: "700" },
  sub: { fontSize: 12, color: "#64748b", lineHeight: 18 },
  li: { fontSize: 13, color: "#475569", marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  forecastRow: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 6, marginBottom: 6, gap: 5 },
  choice: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#f8fafc", marginBottom: 6 },
  choiceActive: { backgroundColor: "#0f172a" },
  choiceText: { fontSize: 13, color: "#475569" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  button: { backgroundColor: "#0f172a", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  infoBox: { backgroundColor: "#f0f9ff", borderWidth: 1, borderColor: "#bae6fd", borderRadius: 14, padding: 12 },
  disclaimer: { fontSize: 11, lineHeight: 16, color: "#64748b", paddingHorizontal: 4 },
});
