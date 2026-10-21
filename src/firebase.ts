import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { TournamentState, GroupKey, DraftGroupState } from './types/tournament';
import { INITIAL_TOURNAMENT_STATE } from './data/initialTournamentState';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const TOURNAMENT_DOC_COLLECTION = 'tournaments';
export const TOURNAMENT_DOC_ID = 'sghs23_season2_clean';

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
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
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

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

/**
 * Recursively converts `undefined` values to `null` so Firestore native maps/lists never throw on undefined properties.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) {
    return null as unknown as T;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = value === undefined ? null : sanitizeForFirestore(value);
  }
  return result as T;
}

/**
 * Builds the validated payload matching firebase-blueprint.json and firestore.rules constraints.
 */
function buildValidatedTournamentPayload(state: TournamentState) {
  const cleanTitle = (state.title || 'SGHS-23 Cricket Tournament season 2').slice(0, 120);
  const cleanSeason = (state.seasonSubtitle || 'Season 2').slice(0, 60);
  const cleanDate = (state.date || '2026-10-22').slice(0, 40);
  const cleanVenue = (state.venue || 'SGHS Central Cricket Ground').slice(0, 120);
  const cleanLogo = (state.logoDataUrl || '').slice(0, 700000);
  const cleanPin = 'PROTECTED';
  const cleanVersion = Math.max(1, Math.min(10000000, Math.floor(state.version || 1)));
  const cleanActiveMatchId =
    (state.activeMatchId || 'match-1').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'match-1';
  const cleanActiveDraftGroup = (state.draft?.activeGroup || '').slice(0, 10);

  return sanitizeForFirestore({
    title: cleanTitle,
    season: cleanSeason,
    date: cleanDate,
    venue: cleanVenue,
    logoDataUrl: cleanLogo,
    organizerPin: cleanPin,
    version: cleanVersion,
    activeMatchId: cleanActiveMatchId,
    activeDraftGroup: cleanActiveDraftGroup,
    players: (state.players || []).slice(0, 30),
    teams: (state.teams || []).slice(0, 6),
    draftGroups: state.draft?.groups || INITIAL_TOURNAMENT_STATE.draft.groups,
    matches: (state.matches || []).slice(0, 10),
    notifications: (state.notifications || []).slice(0, 60),
  });
}

/**
 * Converts a Firestore document snapshot back into a clean TournamentState object.
 */
export function parseTournamentFromFirestore(data: Record<string, unknown>): TournamentState {
  const activeGroupRaw =
    typeof data.activeDraftGroup === 'string' && data.activeDraftGroup.length > 0
      ? (data.activeDraftGroup as GroupKey)
      : null;

  const groupsRaw =
    data.draftGroups && typeof data.draftGroups === 'object'
      ? (data.draftGroups as Record<GroupKey, DraftGroupState>)
      : INITIAL_TOURNAMENT_STATE.draft.groups;

  return {
    sessionId: INITIAL_TOURNAMENT_STATE.sessionId,
    title: typeof data.title === 'string' ? data.title : INITIAL_TOURNAMENT_STATE.title,
    seasonSubtitle:
      typeof data.season === 'string' ? data.season : INITIAL_TOURNAMENT_STATE.seasonSubtitle,
    date: typeof data.date === 'string' ? data.date : INITIAL_TOURNAMENT_STATE.date,
    venue: typeof data.venue === 'string' ? data.venue : INITIAL_TOURNAMENT_STATE.venue,
    logoDataUrl:
      typeof data.logoDataUrl === 'string' && data.logoDataUrl.length > 0
        ? data.logoDataUrl
        : null,
    organizerPin:
      typeof data.organizerPin === 'string'
        ? data.organizerPin
        : INITIAL_TOURNAMENT_STATE.organizerPin,
    defaultOvers: INITIAL_TOURNAMENT_STATE.defaultOvers,
    version: typeof data.version === 'number' ? data.version : 1,
    activeMatchId:
      typeof data.activeMatchId === 'string'
        ? data.activeMatchId
        : INITIAL_TOURNAMENT_STATE.activeMatchId,
    draft: {
      activeGroup: activeGroupRaw,
      groups: groupsRaw,
      lastUpdated: new Date().toISOString(),
    },
    players: Array.isArray(data.players)
      ? (data.players as TournamentState['players'])
      : INITIAL_TOURNAMENT_STATE.players,
    teams: Array.isArray(data.teams)
      ? (data.teams as TournamentState['teams'])
      : INITIAL_TOURNAMENT_STATE.teams,
    matches: Array.isArray(data.matches)
      ? (data.matches as TournamentState['matches'])
      : INITIAL_TOURNAMENT_STATE.matches,
    notifications: Array.isArray(data.notifications)
      ? (data.notifications as TournamentState['notifications'])
      : [],
    processedActionIds: [],
  };
}

let cachedDocExists = false;

export async function saveTournamentStateToFirestore(state: TournamentState): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const docPath = `${TOURNAMENT_DOC_COLLECTION}/${TOURNAMENT_DOC_ID}`;
  const docRef = doc(db, TOURNAMENT_DOC_COLLECTION, TOURNAMENT_DOC_ID);
  const validatedFields = buildValidatedTournamentPayload(state);

  try {
    if (!cachedDocExists) {
      const snap = await getDoc(docRef);
      cachedDocExists = snap.exists();
    }

    if (!cachedDocExists) {
      await setDoc(docRef, {
        ...validatedFields,
        ownerId: currentUser.uid,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      cachedDocExists = true;
    } else {
      await updateDoc(docRef, {
        ...validatedFields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      cachedDocExists ? OperationType.UPDATE : OperationType.CREATE,
      docPath
    );
  }
}

export async function signInOrganizerWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutOrganizer(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, onSnapshot, doc };
export type { User };
