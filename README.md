# Pattes Sécurité

Application Expo / React Native en français pour estimer les conditions de température du sol pendant les promenades avec un chien.

## Démarrer

Prérequis : Node.js 20.19.4 ou plus récent.

```sh
npm install
npx expo start
```

Scannez le QR code avec Expo Go, ou lancez `npm run android`, `npm run ios` ou `npm run web`.

## Fonctionnalités

- Estimation indicative selon la température de l'air, la surface, le soleil et le vent.
- Prévisions horaires simulées ou obtenues avec Open-Meteo après autorisation de localisation.
- Profil du chien, recommandations et historique local conservé sur l'appareil.

Les estimations ne remplacent pas une mesure réelle ni un avis vétérinaire. La météo en direct utilise l'API Open-Meteo ; la position n'est demandée qu'après action de l'utilisateur.
