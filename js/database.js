/**
 * MFIT Personal - Database Module
 * IndexedDB wrapper for offline data persistence
 */

const DB_NAME = 'mfit_personal';
const DB_VERSION = 3; // Bumped for checkins store

const STORES = {
    users: 'users',
    workouts: 'workouts',
    exercises: 'exercises',
    history: 'history',
    assessments: 'assessments',
    progress: 'progress',
    students: 'students',
    checkins: 'checkins',
    settings: 'settings'
};

class Database {
    constructor() {
        this.db = null;
        this.isReady = false;
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[DB] Error opening database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                // DEV: console.log('[DB] Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // DEV: console.log('[DB] Upgrading database...');

                // Users store
                if (!db.objectStoreNames.contains(STORES.users)) {
                    const userStore = db.createObjectStore(STORES.users, { keyPath: 'id', autoIncrement: true });
                    userStore.createIndex('email', 'email', { unique: true });
                    userStore.createIndex('type', 'type', { unique: false });
                }

                // Workouts store
                if (!db.objectStoreNames.contains(STORES.workouts)) {
                    const workoutStore = db.createObjectStore(STORES.workouts, { keyPath: 'id', autoIncrement: true });
                    workoutStore.createIndex('userId', 'userId', { unique: false });
                    workoutStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Exercises store
                if (!db.objectStoreNames.contains(STORES.exercises)) {
                    const exerciseStore = db.createObjectStore(STORES.exercises, { keyPath: 'id', autoIncrement: true });
                    exerciseStore.createIndex('muscle', 'muscle', { unique: false });
                    exerciseStore.createIndex('equipment', 'equipment', { unique: false });
                }

                // History store (workout logs)
                if (!db.objectStoreNames.contains(STORES.history)) {
                    const historyStore = db.createObjectStore(STORES.history, { keyPath: 'id', autoIncrement: true });
                    historyStore.createIndex('userId', 'userId', { unique: false });
                    historyStore.createIndex('workoutId', 'workoutId', { unique: false });
                    historyStore.createIndex('date', 'date', { unique: false });
                }

                // Assessments store
                if (!db.objectStoreNames.contains(STORES.assessments)) {
                    const assessmentStore = db.createObjectStore(STORES.assessments, { keyPath: 'id', autoIncrement: true });
                    assessmentStore.createIndex('userId', 'userId', { unique: false });
                    assessmentStore.createIndex('date', 'date', { unique: false });
                }

                // Students store (for trainers)
                if (!db.objectStoreNames.contains(STORES.students)) {
                    const studentStore = db.createObjectStore(STORES.students, { keyPath: 'id', autoIncrement: true });
                    studentStore.createIndex('trainerId', 'trainerId', { unique: false });
                }

                // Progress store (body measurements)
                if (!db.objectStoreNames.contains(STORES.progress)) {
                    const progressStore = db.createObjectStore(STORES.progress, { keyPath: 'id', autoIncrement: true });
                    progressStore.createIndex('userId', 'userId', { unique: false });
                    progressStore.createIndex('date', 'date', { unique: false });
                }

                // Checkins store (daily workout tracking)
                if (!db.objectStoreNames.contains(STORES.checkins)) {
                    const checkinStore = db.createObjectStore(STORES.checkins, { keyPath: 'id', autoIncrement: true });
                    checkinStore.createIndex('userId', 'userId', { unique: false });
                    checkinStore.createIndex('date', 'date', { unique: false });
                }

                // Settings store
                if (!db.objectStoreNames.contains(STORES.settings)) {
                    db.createObjectStore(STORES.settings, { keyPath: 'key' });
                }

                // DEV: console.log('[DB] Database upgrade complete');
            };
        });
    }

    /**
     * Generic CRUD operations
     */
    async add(storeName, data) {
        if (!this.db) {
            console.warn('[DB] Database not initialized, skipping add');
            return null;
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add({ ...data, createdAt: new Date().toISOString() });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        if (!this.db) {
            console.warn('[DB] Database not initialized, skipping get');
            return null;
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        if (!this.db) {
            console.warn('[DB] Database not initialized, skipping getAll');
            return [];
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        if (!this.db) {
            console.warn('[DB] Database not initialized, skipping getByIndex');
            return [];
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, data) {
        if (!this.db) {
            console.warn('[DB] Database not initialized, skipping update');
            return null;
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put({ ...data, updatedAt: new Date().toISOString() });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        if (!this.db) {
            console.warn('[DB] Database not initialized, skipping delete');
            return;
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        if (!this.db) {
            console.warn('[DB] Database not initialized, skipping clear');
            return;
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Settings helpers
     */
    async getSetting(key) {
        const result = await this.get(STORES.settings, key);
        return result?.value;
    }

    async setSetting(key, value) {
        return this.update(STORES.settings, { key, value });
    }
}

// Export singleton instance
const db = new Database();
export { db, STORES };
