import mongoose from 'mongoose';

export type StorageMode = 'mongodb' | 'memory' | 'disconnected' | 'test-mock';

export interface DatabaseStatus {
  isConnected: boolean;
  type: StorageMode;
  persistent: boolean;
  host?: string;
  name?: string;
  error?: string;
  warning?: string;
}

export const isTestEnvironment = (): boolean =>
  process.env.NODE_ENV === 'test' || process.env.VITEST !== undefined;

export const isProductionEnvironment = (): boolean =>
  process.env.NODE_ENV === 'production';

export const isMemoryModeAllowed = (): boolean => {
  // In-memory storage is strictly forbidden in production
  if (isProductionEnvironment()) {
    return false;
  }
  // In automated test runs, test-mock memory store is always permitted
  if (isTestEnvironment()) {
    return true;
  }
  // In development/preview, memory mode requires explicit opt-in
  return process.env.ALLOW_MEMORY_DB === 'true';
};

let dbStatus: DatabaseStatus = isTestEnvironment()
  ? {
      isConnected: true,
      type: 'test-mock',
      persistent: false,
      host: 'test-in-memory',
      name: 'trackflow-test',
    }
  : {
      isConnected: false,
      type: 'disconnected',
      persistent: false,
    };

// Wire Mongoose connection event listeners to track connection state in real time
let listenersRegistered = false;
const registerMongooseListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on('disconnected', () => {
    if (dbStatus.type === 'mongodb') {
      dbStatus.isConnected = false;
      dbStatus.error = 'MongoDB connection lost. Service is degraded.';
      console.warn('[TrackFlow Database] MongoDB connection disconnected.');
    }
  });

  mongoose.connection.on('reconnected', () => {
    if (dbStatus.type === 'mongodb') {
      dbStatus.isConnected = true;
      dbStatus.error = undefined;
      console.log('[TrackFlow Database] MongoDB connection re-established.');
    }
  });

  mongoose.connection.on('error', (err) => {
    if (dbStatus.type === 'mongodb') {
      dbStatus.error = `MongoDB error: ${err.message}`;
      console.error(`[TrackFlow Database Error] ${err.message}`);
    }
  });
};

export const connectDB = async (): Promise<DatabaseStatus> => {
  registerMongooseListeners();

  const uri = process.env.MONGODB_URI;
  const isProd = isProductionEnvironment();
  const isTest = isTestEnvironment();

  // Test mode fallback
  if (isTest && !uri) {
    dbStatus = {
      isConnected: true,
      type: 'test-mock',
      persistent: false,
      host: 'test-in-memory',
      name: 'trackflow-test',
    };
    return dbStatus;
  }

  // 1. PRODUCTION MODE ENFORCEMENT
  if (isProd) {
    if (!uri) {
      const configError =
        'Fatal configuration error: MONGODB_URI environment variable is required in production mode. Ephemeral in-memory storage is strictly prohibited.';
      console.error(`[Production Safety] ${configError}`);
      dbStatus = {
        isConnected: false,
        type: 'disconnected',
        persistent: false,
        error: configError,
      };
      throw new Error(configError);
    }

    try {
      mongoose.set('strictQuery', true);
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      dbStatus = {
        isConnected: true,
        type: 'mongodb',
        persistent: true,
        host: conn.connection.host,
        name: conn.connection.name,
      };
      console.log(
        `[TrackFlow Production] Connected authoritatively to MongoDB: ${conn.connection.host}/${conn.connection.name}`
      );
      return dbStatus;
    } catch (err: any) {
      const errorMsg = `Fatal: Unable to connect to MongoDB in production mode: ${err.message}`;
      console.error(`[Production Safety] ${errorMsg}`);
      dbStatus = {
        isConnected: false,
        type: 'disconnected',
        persistent: false,
        error: errorMsg,
      };
      throw new Error(errorMsg);
    }
  }

  // 2. MONGODB DEVELOPMENT MODE (When MONGODB_URI is explicitly provided in dev)
  if (uri) {
    try {
      mongoose.set('strictQuery', true);
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 4000,
      });

      dbStatus = {
        isConnected: true,
        type: 'mongodb',
        persistent: true,
        host: conn.connection.host,
        name: conn.connection.name,
      };
      console.log(
        `[TrackFlow Dev] Connected authoritatively to MongoDB: ${conn.connection.host}/${conn.connection.name}`
      );
      return dbStatus;
    } catch (err: any) {
      const errorMsg = `MongoDB connection failed: ${err.message}`;
      console.error(`[TrackFlow Database Error] ${errorMsg}`);
      // Do NOT silently fall back to ephemeral memory when MONGODB_URI was explicitly configured
      dbStatus = {
        isConnected: false,
        type: 'disconnected',
        persistent: false,
        error: `${errorMsg}. Refusing silent fallback to in-memory storage when MONGODB_URI is configured.`,
      };
      return dbStatus;
    }
  }

  // Optional local MongoDB probe in dev if TRY_LOCAL_MONGO=true
  if (process.env.TRY_LOCAL_MONGO === 'true') {
    try {
      mongoose.set('strictQuery', true);
      const conn = await mongoose.connect('mongodb://localhost:27017/trackflow', {
        serverSelectionTimeoutMS: 1000,
        connectTimeoutMS: 1000,
      });
      dbStatus = {
        isConnected: true,
        type: 'mongodb',
        persistent: true,
        host: conn.connection.host,
        name: conn.connection.name,
      };
      console.log(`[TrackFlow] Connected to local MongoDB: ${conn.connection.host}/${conn.connection.name}`);
      return dbStatus;
    } catch {
      // Local daemon unavailable, proceed
    }
  }

  // 3. PREVIEW / DEVELOPMENT IN-MEMORY MODE (Explicit opt-in only)
  if (isMemoryModeAllowed()) {
    dbStatus = {
      isConnected: true,
      type: 'memory',
      persistent: false,
      host: 'in-memory-adapter',
      name: 'trackflow-dev',
      warning:
        'Running in ephemeral in-memory storage mode. Data will reset on server restart. Configure MONGODB_URI for persistence.',
    };
    console.warn(
      '[TrackFlow Development Warning] Running with ephemeral in-memory storage adapter. Data will NOT persist across server restarts.'
    );
    return dbStatus;
  }

  dbStatus = {
    isConnected: false,
    type: 'disconnected',
    persistent: false,
    error: 'No database available. Configure MONGODB_URI or set ALLOW_MEMORY_DB=true in development.',
  };
  return dbStatus;
};

export const getDBStatus = (): DatabaseStatus => {
  // Live sync readyState when mongodb is the active connection
  if (dbStatus.type === 'mongodb') {
    const readyState = mongoose.connection.readyState;
    dbStatus.isConnected = readyState === 1;
    if (readyState !== 1 && !dbStatus.error) {
      dbStatus.error = 'MongoDB disconnected or connecting.';
    } else if (readyState === 1) {
      dbStatus.error = undefined;
    }
  }
  return { ...dbStatus };
};

export const isMemoryMode = (): boolean => {
  return dbStatus.type === 'memory' || dbStatus.type === 'test-mock';
};

/**
 * Authoritative storage mode resolver for model adapters.
 * Ensures model adapters never silently fall back to in-memory storage in production
 * or after an active MongoDB connection disconnects.
 */
export const getActiveStorageMode = (): 'mongodb' | 'memory' | 'none' => {
  const isProd = isProductionEnvironment();
  const status = getDBStatus();

  // If MongoDB is the configured mode, either it is ready or unavailable (never fall back to memory)
  if (status.type === 'mongodb') {
    return mongoose.connection.readyState === 1 ? 'mongodb' : 'none';
  }

  // Production MUST NEVER use memory storage
  if (isProd) {
    return 'none';
  }

  // In test or explicitly permitted dev memory mode, use in-memory adapter
  if (isMemoryModeAllowed() && status.isConnected) {
    return 'memory';
  }

  return 'none';
};

// Middleware helper to check if database is operational
export const checkDatabaseReady = (): boolean => {
  const status = getDBStatus();
  if (isProductionEnvironment()) {
    return status.type === 'mongodb' && status.isConnected;
  }
  return status.isConnected;
};


