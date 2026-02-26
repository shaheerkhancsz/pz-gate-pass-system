declare module 'express-mysql-session' {
    import { Store } from 'express-session';

    interface Options {
        host?: string;
        port?: number;
        user?: string;
        password?: string;
        database?: string;
        checkExpirationInterval?: number;
        expiration?: number;
        createDatabaseTable?: boolean;
        connectionLimit?: number;
        schema?: {
            tableName?: string;
            columnNames?: {
                session_id?: string;
                expires?: string;
                data?: string;
            };
        };
    }

    class MySQLStore extends Store {
        constructor(options: Options, connection?: any);
        get(sid: string, callback: (err: any, session?: any | null) => void): void;
        set(sid: string, session: any, callback?: (err?: any) => void): void;
        destroy(sid: string, callback?: (err?: any) => void): void;
    }

    function createMySQLStore(session: any): typeof MySQLStore;
    export = createMySQLStore;
}

declare module 'mysql2' {
    export interface Pool {
        [key: string]: any;
    }
}
