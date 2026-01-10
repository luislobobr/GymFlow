/**
 * GymFlow - Firebase Configuration
 * Cloud database and authentication setup
 */

// Firebase SDK imports (using CDN modules)
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getStorage,
    ref,
    uploadString,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBlgR8QqzWKcQC-9uqA40taRYdUNfwy9aI",
    authDomain: "gymflow-50b08.firebaseapp.com",
    projectId: "gymflow-50b08",
    storageBucket: "gymflow-50b08.firebasestorage.app",
    messagingSenderId: "859796146420",
    appId: "1:859796146420:web:62de3c4b299f63477376a1"
};

// Initialize Firebase
let app = null;
let db = null;
let auth = null;
let storage = null;
let googleProvider = null;

/**
 * Initialize Firebase services
 */
async function initFirebase() {
    try {
        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApps()[0];
        }

        // Initialize services only if not already done
        if (!db) db = getFirestore(app);
        if (!auth) auth = getAuth(app);
        if (!storage) storage = getStorage(app);
        if (!googleProvider) googleProvider = new GoogleAuthProvider();

        // Enable offline persistence
        try {
            await enableIndexedDbPersistence(db);
            console.log('✅ Offline persistence enabled');
        } catch (err) {
            if (err.code === 'failed-precondition') {
                console.warn('Multiple tabs open, persistence enabled in first tab only');
            } else if (err.code === 'unimplemented') {
                console.warn('Browser does not support persistence');
            }
        }

        console.log('✅ Firebase initialized');
        return true;
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        return false;
    }
}

/**
 * Authentication methods
 */
const firebaseAuth = {
    // Get current user
    getCurrentUser() {
        return auth?.currentUser;
    },

    // Listen to auth state changes
    onAuthChange(callback) {
        return onAuthStateChanged(auth, callback);
    },

    // Sign up with email/password
    async signUp(email, password, name) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: email,
            name: name,
            type: 'student',
            createdAt: new Date().toISOString()
        });

        return user;
    },

    // Sign in with email/password
    async signIn(email, password) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    },

    // Sign in with Google (Popup with Redirect Fallback)
    async signInWithGoogle() {
        // 1. Prefer Redirect on known mobile devices
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            await signInWithRedirect(auth, googleProvider);
            return null;
        }

        // 2. Try Popup on Desktop/Other
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            await this._handleUser(user);
            return user;
        } catch (error) {
            // 3. Fallback to Redirect if Popup fails (blocked, closed, mobile desktop mode)
            if (error.code === 'auth/popup-blocked' ||
                error.code === 'auth/popup-closed-by-user' ||
                error.code === 'auth/cancelled-popup-request') {

                console.warn('Popup failed, falling back to redirect:', error.code);
                await signInWithRedirect(auth, googleProvider);
                return null;
            }
            throw error;
        }
    },

    // Handle user data after login
    async _handleUser(user) {
        // Check if user exists, if not create document
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                name: user.displayName || 'Usuário',
                avatar: user.photoURL,
                type: 'student',
                createdAt: new Date().toISOString()
            });
        }
    },

    // Check for redirect result (called on page load)
    async checkRedirectResult() {
        try {
            const result = await getRedirectResult(auth);
            if (result && result.user) {
                await this._handleUser(result.user);
                return result.user;
            }
        } catch (error) {
            console.error('Redirect result error:', error);
            throw error;
        }
        return null;
    },

    // Sign out
    async signOut() {
        await signOut(auth);
    }
};

/**
 * Firestore database wrapper (compatible with existing API)
 */
const firebaseDB = {
    // Collections
    COLLECTIONS: {
        users: 'users',
        workouts: 'workouts',
        exercises: 'exercises',
        history: 'history',
        assessments: 'assessments',
        progress: 'progress',
        students: 'students',
        settings: 'settings'
    },

    // Get document by ID
    async get(collectionName, id) {
        const docRef = doc(db, collectionName, String(id));
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    },

    // Get all documents in collection
    async getAll(collectionName) {
        const querySnapshot = await getDocs(collection(db, collectionName));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // Get documents by index (field value)
    async getByIndex(collectionName, field, value) {
        const q = query(collection(db, collectionName), where(field, '==', value));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // Add new document
    async add(collectionName, data) {
        const docRef = await addDoc(collection(db, collectionName), {
            ...data,
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    },

    // Update document
    async update(collectionName, data) {
        const docRef = doc(db, collectionName, String(data.id));
        await updateDoc(docRef, {
            ...data,
            updatedAt: new Date().toISOString()
        });
        return data;
    },

    // Delete document
    async delete(collectionName, id) {
        await deleteDoc(doc(db, collectionName, String(id)));
        return true;
    },

    // Get setting
    async getSetting(key, userId = 'global') {
        const docRef = doc(db, 'settings', `${userId}_${key}`);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data().value : null;
    },

    // Set setting
    async setSetting(key, value, userId = 'global') {
        await setDoc(doc(db, 'settings', `${userId}_${key}`), {
            key,
            value,
            userId,
            updatedAt: new Date().toISOString()
        });
        return true;
    },

    // Subscribe to real-time updates
    subscribe(collectionName, field, value, callback) {
        const q = query(collection(db, collectionName), where(field, '==', value));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(data);
        });
    }
};

/**
 * Storage methods for photos
 */
const firebaseStorage = {
    // Upload image (base64)
    async uploadImage(path, base64Data) {
        const storageRef = ref(storage, path);
        const snapshot = await uploadString(storageRef, base64Data, 'data_url');
        return await getDownloadURL(snapshot.ref);
    },

    // Get image URL
    async getImageUrl(path) {
        const storageRef = ref(storage, path);
        return await getDownloadURL(storageRef);
    }
};

// Export
export {
    initFirebase,
    firebaseAuth,
    firebaseDB,
    firebaseStorage,
    db,
    auth,
    storage
};
