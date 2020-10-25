import { readdirSync } from 'fs';
import { join } from 'path';
import { db } from '../connection';
import Migration from '.';

/**
 * Controller for migrations.
 *
 * @author Charles Sabarillo <charles.sabarillo@digify.com.ph>
 */
export const Migrations = new class MigrationController
{
  constructor()
  {
    /**
		 * Wrapping the knex query builder to query from the migrations table.
		 * @returns {import('knex').QueryBuilder}
		 */
		this.migrations = () => db('migrations');
	}

	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  /**
   * Creates the migrations table.
	 * 
	 * @param {string} modulesPath Path to the migration modules.
	 * @returns {Promise<boolean>} If creating the migrations table was successful.
   */
  async init(modulesPath)
  {
		if(! modulesPath)
			throw MigrationError('Please provide the path of the migration files.');

		this.modulesPath = modulesPath;
		
		try
		{
			/* Check if the migrations table exists. If not, create it. */
			const migrationsExists = await db().schema.hasTable('migrations')
			if(migrationsExists)
				return true;

			/* Create migration versions table. */
			await db().schema
				.createTable('migrations', table =>
				{
					table.string('module', 50);
					table.integer('version', 3);
					table.index('module', 'module');
				});

			console.log('Migrations table was created.');
			return true;
		}
		catch(error)
		{
			console.log('Failed to create migrations table.');
			console.log(error);
			return false;
		}
  }

	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  /**
   * Migrate a module.
   *
   * @param {string} moduleName The name of the migration's module to run.
   * @param {number} [version] The version of the migration to migrate to.
	 * @returns {Promise<boolean | void>}
   */
  migrate(moduleName, version)
  {
    return this._doMigration(moduleName, true, version);
  }

	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  /**
   * Rollback a module.
   *
   * @param {string} moduleName The name of the migration's module to run.
   * @param {number} [version] The version of the migration to rollback to.
	 * @return {Promise<boolean | void>}
   */
  rollback(moduleName, version)
  {
    return this._doMigration(moduleName, false, version);
  }

	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  /**
	 * Get the current version of a module's migration.
	 *
   * @param {string} moduleName The name of the module to get the migration version.
	 * @returns {Promise<number | void>}
   */
  async getVersion(moduleName)
  {
		try
		{
			const queryResult = await this.migrations()
				.select('version')
				.where({ module: moduleName })
				.first();

			return ! queryResult ? null : queryResult.version;
		}
		catch(error)
		{
			console.log(`Cannot get the migration version of the '${moduleName}' module.`);
			console.log(error);
			return;
		}
  }

	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

	/**
   * @private
   * @param {string} moduleName The name of the module to get migration files of.
	 */
	async _getMigrations(moduleName)
	{
		const migrations = [];

		try
		{
			/* Get the migration files path. */
			const migrationsPath = `${this.modulesPath}/${moduleName}/migrations`;

			/* Get the migration files (JavaScript files). */
			const migrationFiles = readdirSync(migrationsPath)
				.filter(file => file.endsWith('.js'));

				
			for(let file of migrationFiles)
			{
				/**
				 * Import the migration file.
				 * @type {import('.')}
				 */
				file = await import(join(`${process.cwd()}/${migrationsPath}/${file}`));

				/* Check if the file has a default export. */
				if(! file.default || typeof file.default !== 'function')
					continue;

				const migration = new file.default();
				if(! migration instanceof Migration)
					continue;

				migrations.push(migration);
			}
	
			return migrations;
		}
		catch(error)
		{
			console.log(`Cannot get the migrations of the '${moduleName}' module.`);
			console.log(error);
			return;
		}
	}

	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  /**
   * @private
   * @param {string} moduleName The name of the module of the migration to run.
   * @param {boolean} toUpgrade If migrating up or down.
   * @param {number} [version] The version of the migration to migrate to.
	 * @returns {Promise<boolean | void>}
   */
  async _doMigration(moduleName, toUpgrade, version)
  {
		console.log(`${toUpgrade ? 'Migrating' : 'Rolling back'} the '${moduleName}' module...`);

    if(! moduleName)
			throw new MigrationError('Please provide the module to migrate.');

		/* Check if the version is not a valid version. */
		if(version !== 'latest' && (version !== undefined && isNaN(version)) || version < 0)
			throw new MigrationError('Please provide a valid migration version.');
			
		/* Get the list of the module's migration files. */
		let migrations = await this._getMigrations(moduleName);
		if(! migrations)
			return console.log(`Cannot get the migrations of the '${moduleName}' module.`);

		const latestVersion = migrations.length;

		/* Get the current version of the module's migration. */
		const currentVersion = await this.getVersion(moduleName);
			
		/* If the version is not given... */
		if(version === undefined)
		{
			/* And if there is no current version... */
			if(currentVersion === null)
			{
				/* And if a rollback is going to be executed, do not execute any migration. */
				if(toUpgrade)
					return;

				/* If a rollback is not going to be executed, set the version to 1. */
				version = 1;
			}

			/* And if there is a current version, add (if migrating up)
				or subtract 1 (if to rollback) from the version. */
			else
				version = currentVersion + (toUpgrade ? 1 : -1);
		}
		else
		{
			/* Set the version to migrate to as the latest version if migrating to the latest. */
			if(version === 'latest')
			{
				if(toUpgrade)
					version = latestVersion;
				else
					throw new MigrationError(`Cannot rollback the ${moduleName} module to 'latest'`);
			}
		}

		/* If migrating up and the version given is less than
			the current version, do not execute any migrations. */
		if(toUpgrade && version < currentVersion)
			throw new MigrationError('Cannot migrate to a previous version. Please rollback instead.');

		/* If migrating down and the current version is less than
			the given version, do not execute any migrations. */
		if(! toUpgrade && version > currentVersion)
			throw new MigrationError('Cannot rollback to a later version. Please migrate instead.');

		if(
			version > latestVersion ||
			(toUpgrade && currentVersion === latestVersion)
		)
			return console.log(`The '${moduleName}' module is already in the latest migration version.`);

		if(! toUpgrade && currentVersion === 0)
			return console.log(`The '${moduleName}' module has not yet been migrated.`);

		/* If the current version of the module's migration is the same as the
			given version, do not execute any migration. */
		if(version === currentVersion)
			return console.log(`The '${moduleName}' module is already in the given migration version.`);

		/* Proceed to migration. */
		try
		{
			/* If the difference of the given version and the current version
				is greater than 1, call the function that executes multiple migrations.
				If not, call the function that executes just one migration. */
			let migrationResult ;

			if(Math.abs(version - (currentVersion || 0)) <= 1)
				migrationResult = await this
					._runMigration(migrations[toUpgrade ? version - 1: version], toUpgrade);
			else
			{
				if(toUpgrade)
					migrations = migrations.slice(currentVersion, version);
				else
					migrations = migrations.slice(version, currentVersion);

				if(! toUpgrade)
					migrations = migrations.reverse();

					migrationResult = await this._migrateMany(migrations, toUpgrade);
			}

			if(! migrationResult)
				return;

			/* Update the module's migration version. */
			await this._updateMigrationVersion(moduleName, version, currentVersion === null);

			/* Log migration result. */
			console.log((toUpgrade? 'Migrated' : 'Rollbacked')
				+ ` the \`${moduleName}\` module to version ${version}.`);
		}
		catch(error)
		{
			console.log(error);
		}
  }

	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  /**
   * Executes multiple migrations.
   *
   * @private
   * @param {Migration[]} migrations The migration files of the module.
   * @param {boolean} [toUpgrade] If the operation is to migrate up or rollback.
	 * @returns {Promise<boolean | void>}
   */
  async _migrateMany(migrations, toUpgrade)
  {
    /* Loop through and run each migration file. */
		for(const migration of migrations)
		{
			const migrationResult = await this._runMigration(migration, toUpgrade);
			if(! migrationResult)
				return;
		}

		/* Returns `true` to signify all migrations were successful. */
		return true;
  }

	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  /**
   * Imports and runs the given migration file.
   *
   * @private
   * @param {Migration} migration
   * @param {boolean} toUpgrade
	 * @returns {Promise<boolean | void>}
   */
  async _runMigration(migration, toUpgrade)
  {
		try
		{
			/* Perform the migration or rollback. */
			await (toUpgrade ? migration.up() : migration.down());
			console.log(`'${migration.constructor.name}' ${toUpgrade ? 'migrated' : 'rollbacked'}`);
			return true;
		}
		catch(error)
		{
			const migrationName = migration.constructor.name;
			console.log(`Failed to run the '${migrationName}' migration.`);
			console.log(error);
		}
  }

	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  /**
   * Updates the migration version of the module.
   *
   * @private
   * @param {string} moduleName
   * @param {number} version
   * @param {boolean} toInsert
	 * @returns {Promise}
   */
  async _updateMigrationVersion(moduleName, version, toInsert)
  {
		if(toInsert)
		{
			await this.migrations().insert({ module: moduleName, version })
			return;
		}

		await this.migrations()
      .where({ module: moduleName })
      .update({ version });
  }
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

/* Custom Errors for migrations. */
class MigrationError extends Error
{
  constructor(message)
  {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, MigrationError);
  }
}
