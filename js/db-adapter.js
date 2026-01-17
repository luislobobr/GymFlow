/**
 * GymFlow - Database Adapter
 * Unified interface for IndexedDB (offline) and Firebase (cloud)
 */

// Import both databases
import { db as localDB, STORES } from './database.js';

/**
 * NOTA DE DESENVOLVIMENTO:
 * Algumas funções async neste arquivo podem não ter tratamento de erros adequado.
 * Considere adicionar blocos try-catch onde apropriado para melhorar a robustez.
 * Especialmente em operações de banco de dados e chamadas de API.
 */


// Firebase will be imported dynamically when enabled
let firebaseModule = null;
let useFirebase = false;

/**
 * Database configuration
 * Firebase HABILITADO - sincronização com cloud
 */
const dbConfig = {
    useCloud: true,
    isFirebaseReady: false
};

/**
 * Initialize database adapter
 */
async function initDatabase() {
    // Initialize local DB first (for offline support)
    await localDB.init();

    // Try to enable Firebase if cloud mode is on
    if (dbConfig.useCloud) {
        try {
            firebaseModule = await import('./firebase-config.js');
            await firebaseModule.initFirebase();
            useFirebase = true;
            dbConfig.isFirebaseReady = true;
            console.log('✅ Firebase cloud sync enabled');
        } catch (e) {
            console.warn('⚠️ Firebase not available, using local only:', e.message);
            useFirebase = false;
        }
    } else {
        useFirebase = false;
    }
    return true;
}

/**
 * Get the active database instance
 */
function getDB() {
    if (useFirebase && firebaseModule) {
        return firebaseModule.firebaseDB;
    }
    return localDB;
}

/**
 * Unified Database API
 */
const database = {
    isReady: false,

    /**
     * Initialize database
     */
    async init() {
        await initDatabase();
        this.isReady = true;
        return true;
    },

    /**
     * Get document by ID
     */
    async get(store, id) {
        return getDB().get(store, id);
    },

    /**
     * Get all documents in store
     */
    async getAll(store) {
        return getDB().getAll(store);
    },

    /**
     * Get documents by index
     */
    async getByIndex(store, field, value) {
        return getDB().getByIndex(store, field, value);
    },

    /**
     * Add new document
     */
    async add(store, data) {
        const id = await getDB().add(store, data);

        // If using Firebase, also sync to local for offline
        if (useFirebase) {
            await localDB.add(store, { ...data, cloudId: id });
        }

        return id;
    },

    /**
     * Update document
     */
    async update(store, data) {
        const result = await getDB().update(store, data);

        // Sync to local if using Firebase
        if (useFirebase) {
            await localDB.update(store, data);
        }

        return result;
    },

    /**
     * Delete document
     */
    async delete(store, id) {
        await getDB().delete(store, id);

        if (useFirebase) {
            await localDB.delete(store, id);
        }

        return true;
    },

    /**
     * Get setting
     */
    async getSetting(key) {
        return getDB().getSetting(key);
    },

    /**
     * Set setting
     */
    async setSetting(key, value) {
        return getDB().setSetting(key, value);
    },

    /**
     * Enable cloud sync
     */
    async enableCloud() {
        dbConfig.useCloud = true;
        await initDatabase();
    },

    /**
     * Disable cloud sync (offline only)
     */
    disableCloud() {
        dbConfig.useCloud = false;
        useFirebase = false;
    },

    /**
     * Check if cloud is enabled
     */
    isCloudEnabled() {
        return useFirebase;
    },

    /**
     * Sync local data to cloud
     */
    async syncToCloud() {
        if (!useFirebase || !firebaseModule) {
            console.warn('Cloud sync not available');
            return false;
        }

        const stores = Object.values(STORES);

        for (const store of stores) {
            try {
                const localData = await localDB.getAll(store);
                for (const item of localData) {
                    if (!item.cloudId) {
                        // Upload to cloud
                        const cloudId = await firebaseModule.firebaseDB.add(store, item);
                        // Update local with cloudId
                        await localDB.update(store, { ...item, cloudId });
                    }
                }
            } catch (error) {
                console.error(`Error syncing ${store}:`, error);
            }
        }

        // DEV: console.log('✅ Sync complete');
        return true;
    }
};

/**
 * Authentication API (wraps Firebase Auth when available)
 */
const auth = {
    currentUser: null,

    /**
     * Sign up with email/password
     * @param {string} email
     * @param {string} password
     * @param {string} name
     * @param {string} type - 'student' or 'trainer'
     */
    async signUp(email, password, name, type = 'student') {
        if (useFirebase && firebaseModule) {
            const user = await firebaseModule.firebaseAuth.signUp(email, password, name, type);
            this.currentUser = user;
            return user;
        }

        // Fallback to local user creation
        const user = {
            id: Date.now(),
            email,
            name,
            type: type,
            createdAt: new Date().toISOString()
        };
        await localDB.add(STORES.users, user);
        this.currentUser = user;
        return user;
    },

    /**
     * Sign in
     */
    async signIn(email, password) {
        if (useFirebase && firebaseModule) {
            const user = await firebaseModule.firebaseAuth.signIn(email, password);
            this.currentUser = user;
            return user;
        }

        // Fallback to local auth
        const users = await localDB.getByIndex(STORES.users, 'email', email);
        if (users.length > 0) {
            this.currentUser = users[0];
            return users[0];
        }
        throw new Error('User not found');
    },

    /**
     * Sign in with Google
     */
    async signInWithGoogle() {
        if (useFirebase && firebaseModule) {
            const user = await firebaseModule.firebaseAuth.signInWithGoogle();
            this.currentUser = user;
            return user;
        }
        throw new Error('Google sign-in requires cloud mode');
    },

    /**
     * Sign out
     */
    async signOut() {
        if (useFirebase && firebaseModule) {
            await firebaseModule.firebaseAuth.signOut();
        }
        this.currentUser = null;
        await database.setSetting('currentUserId', null);
    },

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    },

    /**
     * Check if authenticated
     */
    isAuthenticated() {
        return !!this.currentUser;
    }
};

// Export unified API
export { database, auth, STORES };
export default database;
