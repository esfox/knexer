import knex from 'knex';

class Connection
{
	/**
	 * Initialize the database connection.
	 * 
	 * @param {import('knex').Config} options Config for the Knex database connection.
	 */
	static initDB(options = {})
	{
		/* Check if the connection has already been initialized. */
		if(Connection.instance)
			return;

		const config =
		{
			client: options.client || process.env.DATABASE_CLIENT,
			...options
		};

		if(! config.client)
			throwConfigError('database `client` config');
	
		let connection = options.connection || process.env.DATABASE_CONNECTION;
		if(typeof connection === 'string')
		{
			config.connection = connection;
			Connection.instance = knex(config);
			return;
		}

		options.connection = options.connection || {};

		if(config.client === 'sqlite3')
		{
			const sqlitePath = options.connection.filename || process.env.SQLITE_PATH;
			if(! sqlitePath)
				throwConfigError('SQLite database path.');

			config.connection = { filename: sqlitePath };
			config.useNullAsDefault = true;
			Connection.instance = knex(config);
			return;
		}

		config.connection =
		{
			host: options.connection.host || process.env.DATABASE_HOST,
			user: options.connection.user || process.env.DATABASE_USER,
			password: options.connection.password || process.env.DATABASE_PASSWORD,
			database: options.connection.database || process.env.DATABASE_NAME,
		};

		if(! config.connection.host)
			throwConfigError('connection host');
	
		if(! config.connection.user)
			throwConfigError('database username');
	
		if(! config.connection.password)
			throwConfigError('database password');
	
		if(! config.connection.database)
			throwConfigError('database name');

		const port = options.connection.port || process.env.DATABASE_PORT;
		if(port && ! isNaN(port))
			config.connection.port = parseInt(port);

		Connection.instance = knex(config);
	}

	/**
	 * Returns the Knex connection object.
	 * 
	 * @param {string} table Table to query.
	 * @returns {import('knex')}
	 */
	static db(table)
	{
		if(! Connection.instance)
			throw Error('Please initialize the database connection first using `initDB()`.');

		return ! table ? Connection.instance : Connection.instance(table);
	}
}

// const connection = new Connection();
export const initDB = Connection.initDB;
export const db = Connection.db;

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

function throwConfigError(missingConfig)
{
	throw Error(`Please provide the ${missingConfig}.`);
}
