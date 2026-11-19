import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';

interface FirebaseAppletConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

const configModules = import.meta.glob<{ default: FirebaseAppletConfig }>(
  '../../firebase-applet-config.json',
  { eager: true }
);
const fileConfig =
  Object.values(configModules)[0]?.default ?? ({} as FirebaseAppletConfig);

function cleanEnv(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

const firebaseConfig: FirebaseAppletConfig = {
  apiKey: cleanEnv(import.meta.env.VITE_FIREBASE_API_KEY) || cleanEnv(fileConfig.apiKey),
  authDomain:
    cleanEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || cleanEnv(fileConfig.authDomain),
  projectId:
    cleanEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID) || cleanEnv(fileConfig.projectId),
  storageBucket:
    cleanEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || cleanEnv(fileConfig.storageBucket),
  messagingSenderId:
    cleanEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
    cleanEnv(fileConfig.messagingSenderId),
  appId: cleanEnv(import.meta.env.VITE_FIREBASE_APP_ID) || cleanEnv(fileConfig.appId),
  firestoreDatabaseId:
    cleanEnv(import.meta.env.VITE_FIREBASE_DATABASE_ID) ||
    cleanEnv(fileConfig.firestoreDatabaseId) ||
    '(default)',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let initError: string | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    try {
      firestoreInstance = initializeFirestore(
        app,
        { experimentalForceLongPolling: true },
        databaseId
      );
    } catch {
      firestoreInstance = getFirestore(app, databaseId);
    }
    authInstance = getAuth(app);
  } catch (err) {
    initError = err instanceof Error ? err.message : String(err);
  }
} else {
  initError =
    'Configuration Firebase manquante. Ajoutez firebase-applet-config.json ou les variables VITE_FIREBASE_* dans les paramètres Vercel.';
}

export const firebaseInitError = initError;
export const db = firestoreInstance as Firestore;
export const auth: Auth | null = authInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
