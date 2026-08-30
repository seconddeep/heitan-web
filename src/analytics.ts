import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  initializeAnalytics,
  isSupported,
  logEvent,
  type Analytics,
} from "firebase/analytics";

export type GameCompleteResult = "black_win" | "white_win" | "draw";

export type ProductAnalyticsEvent =
  | {
      readonly name: "game_start" | "undo" | "board_size_selected";
      readonly parameters: { readonly board_size: string };
    }
  | {
      readonly name: "game_complete";
      readonly parameters: {
        readonly board_size: string;
        readonly result: GameCompleteResult;
      };
    }
  | {
      readonly name: "rules_open";
    };

export interface ProductAnalytics {
  readonly track: (event: ProductAnalyticsEvent) => void;
}

export const noOpProductAnalytics: ProductAnalytics = {
  track: () => undefined,
};

function getFirebaseOptions(): FirebaseOptions | null {
  const options = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  };

  return Object.values(options).every(
    (value) => typeof value === "string" && value.trim() !== "",
  )
    ? options
    : null;
}

async function initializeFirebaseAnalytics(): Promise<Analytics | null> {
  const enabled =
    import.meta.env.PROD ||
    import.meta.env.VITE_FIREBASE_ANALYTICS_ENABLED === "true";
  const options = getFirebaseOptions();

  if (!enabled || options === null || !(await isSupported())) {
    return null;
  }

  const app =
    getApps().find((candidate) => candidate.name === "heitan-web-analytics") ??
    initializeApp(options, "heitan-web-analytics");

  // Firebase Analytics sends page_view automatically with its default settings.
  return initializeAnalytics(app);
}

export function createFirebaseProductAnalytics(): ProductAnalytics {
  const analytics = initializeFirebaseAnalytics().catch(() => null);

  return {
    track: (event) => {
      void analytics
        .then((instance) => {
          if (instance === null) {
            return;
          }

          logEvent(
            instance,
            event.name,
            "parameters" in event ? event.parameters : undefined,
          );
        })
        .catch(() => undefined);
    },
  };
}
