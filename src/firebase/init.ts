import { initializeApp, cert, getApps } from "firebase-admin/app";
import type { App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";
import dotenv from "dotenv";

dotenv.config();

class FirebaseService {
  private static instance: FirebaseService;
  private _app: App;
  private _db: Firestore;
  private _storage: Storage;

  private constructor() {
    const projectId = process.env.FIREBASE_PROJECT_ID || "nomeet-b84a6";
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@nomeet-b84a6.iam.gserviceaccount.com";
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
    const privateKey = rawPrivateKey
      ? rawPrivateKey
          .trim()
          .replace(/^["']|["']$/g, "")
          .replace(/\\n/g, "\n")
      : undefined;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "nomeet-b84a6";

    const existingApps = getApps();
    if (existingApps.length > 0) {
      this._app = existingApps[0]!;
    } else {
      if (projectId && clientEmail && privateKey) {
        this._app = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          storageBucket,
        });
      } else {
        this._app = initializeApp({
          projectId,
          storageBucket,
        });
      }
    }

    this._db = getFirestore(this._app);
    this._storage = getStorage(this._app);

    console.log(`[Firebase] Initialized with project: ${projectId}, storageBucket: ${storageBucket}`);
  }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  get app(): App {
    return this._app;
  }
  get storage(): Storage {
    return this._storage;
  }
  get db(): Firestore {
    return this._db;
  }
}

const firebase = FirebaseService.getInstance();

export const app = firebase.app;
export const db = firebase.db;
export const storage = firebase.storage;