// Estimations pédagogiques uniquement : la température réelle varie selon le lieu,
// l'ombre, les matériaux et les conditions locales.
export const RACES = {
  petit: { label: "Petit chien", poids: "moins de 10 kg", marge: -2 },
  moyen: { label: "Chien moyen", poids: "10–25 kg", marge: 0 },
  grand: { label: "Grand chien", poids: "plus de 25 kg", marge: 1 },
};

export const PELAGES = {
  court: { label: "Poil court", marge: -1 },
  normal: { label: "Poil normal", marge: 0 },
  epais: { label: "Poil épais / double", marge: 1 },
};

export const VULNERABILITE = {
  adulte: { label: "Adulte en bonne santé", marge: 0 },
  chiot: { label: "Chiot", marge: -3 },
  senior: { label: "Senior", marge: -3 },
  fragile: { label: "Sensibilité particulière", marge: -5 },
};

export const SURFACES = {
  asphalte: { label: "Asphalte", soleil: 1.0 },
  beton: { label: "Béton", soleil: 0.75 },
  sable: { label: "Sable", soleil: 0.9 },
  herbe: { label: "Herbe", soleil: 0.25 },
};

const FACTEUR_SOLEIL = { faible: 0.35, modere: 0.7, fort: 1 };
const FACTEUR_VENT = { faible: 0, modere: 0.12, fort: 0.25 };

export function groundTemp(air, surface, soleil = "modere", vent = "faible", heure = 12) {
  const airTemp = Number.isFinite(Number(air)) ? Number(air) : 20;
  const sf = SURFACES[surface] ?? SURFACES.asphalte;
  const sunFactor = FACTEUR_SOLEIL[soleil] ?? FACTEUR_SOLEIL.modere;
  const windFactor = FACTEUR_VENT[vent] ?? 0;
  const daylight = Math.max(0, Math.sin(((Number(heure) - 6) / 12) * Math.PI));
  const solarGain = 24 * sf.soleil * sunFactor * daylight;
  const cooling = Math.max(0, solarGain) * windFactor;
  return Math.round((airTemp + solarGain - cooling) * 10) / 10;
}

export function evaluate(ground, marge = 0) {
  const threshold = 45 + marge;
  if (ground >= threshold) {
    return {
      niveau: "danger", couleur: "#b91c1c", icone: "🚫", titre: "Danger pour les coussinets",
      conseils: ["Évitez cette surface et privilégiez un trajet à l'ombre ou sur l'herbe.", "Attendez que le sol refroidisse avant de repartir."],
    };
  }
  if (ground >= threshold - 8) {
    return {
      niveau: "prudence", couleur: "#c2410c", icone: "⚠️", titre: "Sol très chaud",
      conseils: ["Limitez le temps de contact avec cette surface.", "Choisissez l'ombre ou l'herbe et vérifiez régulièrement les pattes."],
    };
  }
  if (ground < 5) {
    return {
      niveau: "froid", couleur: "#0369a1", icone: "❄️", titre: "Sol froid",
      conseils: ["Surveillez le confort de votre chien, surtout s'il est sensible au froid.", "Rincez et séchez les pattes après une sortie salée ou humide."],
    };
  }
  return {
    niveau: "ok", couleur: "#15803d", icone: "✅", titre: "Conditions plutôt favorables",
    conseils: ["Les conditions semblent plus favorables, mais vérifiez le sol directement.", "Restez attentif aux signes d'inconfort et adaptez la sortie à votre chien."],
  };
}

const soleilDepuisRadiation = (radiation) => {
  if (radiation >= 500) return "fort";
  if (radiation >= 150) return "modere";
  return "faible";
};
const ventDepuisVitesse = (vitesse) => {
  if (vitesse >= 30) return "fort";
  if (vitesse >= 12) return "modere";
  return "faible";
};

export async function fetchLiveWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,wind_speed_10m,shortwave_radiation",
    hourly: "temperature_2m,wind_speed_10m,shortwave_radiation",
    forecast_days: "2",
    timezone: "auto",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) throw new Error("Impossible de récupérer la météo.");
  const data = await response.json();
  if (!data.current || !data.hourly) throw new Error("Réponse météo incomplète.");

  const currentHour = String(data.current.time).slice(0, 13);
  let start = data.hourly.time.findIndex((time) => time.startsWith(currentHour));
  if (start < 0) start = data.hourly.time.findIndex((time) => Number(time.slice(11, 13)) >= new Date().getHours());
  if (start < 0) start = 0;

  const hourly = data.hourly.time.slice(start, start + 14).map((time, offset) => {
    const index = start + offset;
    return {
      heure: Number(time.slice(11, 13)),
      air: data.hourly.temperature_2m[index],
      soleil: soleilDepuisRadiation(data.hourly.shortwave_radiation[index] ?? 0),
      vent: ventDepuisVitesse(data.hourly.wind_speed_10m[index] ?? 0),
    };
  }).filter((item) => Number.isFinite(item.air));

  const air = Number(data.current.temperature_2m);
  const wind = Number(data.current.wind_speed_10m ?? 0);
  const radiation = Number(data.current.shortwave_radiation ?? 0);
  if (!Number.isFinite(air)) throw new Error("Température météo invalide.");
  return {
    air,
    vent: ventDepuisVitesse(wind),
    soleil: soleilDepuisRadiation(radiation),
    hourly,
    source: "Open-Meteo",
  };
}
