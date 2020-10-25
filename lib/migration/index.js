import { db } from '../connection';

/**
 * @typedef Migration
 * @property {string} table The table name associated with this migration.
 * @property {Function} up Function for migrating up.
 * @property {Function} down Function for migrating down.
 */

/**
 * Base class for creating migrations.
 * 
 * @author Charles Sabarillo <charles.sabarillo@digify.com.ph>
 */
export default class Migration
{
	/**
	* @param {string} tableName The name of the table to associate this migration with.
	*/
	constructor(tableName)
	{
		this.tableName = tableName;
		this.db = db();
		this.table = db(tableName);
	}

	/** @override */
	async up() {}
	
	/** @override */
	async down() {}
}
