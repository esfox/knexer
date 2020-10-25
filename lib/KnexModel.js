import { db } from '../lib/connection';

/**
 * Base model for querying tables.
 * 
 * @author Charles Sabarillo <charles.sabarillo@digify.com.ph>
 */
export class KnexModel
{

	/**
	 * @typedef KnexModelParams
	 * @property {string} table Table to associate with this model.
	 * @property {string} primaryKey Name of the primary key of the table.
	 */

	/** @param {KnexModelParams} */
	constructor({ table, primaryKey })
	{
		/** @type {import('knex').QueryBuilder} */
		this.query = () => db(table);
		
		if(! table)
			throw new Error(`Please set the table field of the model for the '${table}' table.`);

		this.table = table;

		if(! primaryKey)
			throw new Error(`Please set the primary key field of the model for the '${table}' table.`);
			
		this.primaryKey = primaryKey;
	}
	
	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

	/**
	 * Gets all records.
	 * 
	 * @param {number} page Number of the page of records to get (for pagination).
	 * @param {limit} limit Number of records to get.
	 */
	findAll(page = 1, limit = 10)
	{
		const query = this.query()
			.limit(limit)
			.offset(limit * (page - 1));

		this.lastQuery = query.toQuery();

		return query
			.catch(this._catchError);
	}
	
	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

	/**
	 * Gets one record by id.
	 * 
	 * @param {number} id ID of the record to get.
	 */
	find(id)
	{
		const query = this.query()
			.where({ [this.primaryKey]: id })
			.first();

		this.lastQuery = query.toQuery();

		return query
			.then(result => result || 0)
			.catch(this._catchError);
	}
	
	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

	/**
	 * Creates a record and returns the inserted row.
	 * 
	 * @param {{}} data Data to insert.
	 */
	insert(data)
	{
		const query = this.query()
			.insert(data)
			.returning('*');

		this.lastQuery = query.toQuery();
		
		return query
			.then(([ result ]) => result || 0)
			.catch(this._catchError);
	}
	
	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

	/**
	 * Edits a record.
	 * 
	 * @param {number} id ID of the record to update.
	 * @param {{}} data New data to set to the record.
	 */
	update(id, data)
	{
		const query = this.query()
			.where({ [this.primaryKey]: id })
			.update(data)
			.returning('*');

		this.lastQuery = query.toQuery();

		return query
			.then(([ result ]) => result || 0)
			.catch(this._catchError);
	}
	
	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

	/**
	 * Deletes a record.
	 * 
	 * @param {number} id ID of the record to delete.
	 */
	delete(id)
	{
		const query = this.query()
			.where({ [this.idColumn]: id })
			.delete();

		this.lastQuery = query.toQuery();
		
		return query
			.catch(this._catchError);
	}
	
	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

	/**
	 * Catches and logs errors.
	 * 
	 * @private
	 */
	_catchError = error =>
	{
		console.error(error);
		return null;
	}
}
