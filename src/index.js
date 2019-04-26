import {useState, useEffect} from 'react';

/**
 * This is a buffer for the hook data objects. They are identified by data-ids that
 * are made up from type and id. So for example 'article:1'. If multiple hooks tap into
 * the same data, they will return exactly the same data.
 * @type {{}}
 */
let hookStore = {};

/**
 * This is a storage to keep references to mounted components so they can be updated
 * when the data they have been hooked into got updated.
 * @type {{}}
 */
let registeredComponents = {};

/**
 * Will trigger a render of all components with the given data-id.
 * @param {string} dataId
 */
const updateComponents = (dataId) => {
	const components = registeredComponents[dataId];

	if (!components || !components.length) {
		return;
	}

	const updateVal = Date.now();
	components.forEach(update => update(updateVal));
};

const responders = {
	fetch: [],
	update: [],
	remove: []
};

/**
 * Triggers a data fetch from the outside, if possible.
 * @param {string} type
 * @param {string} id
 */
const fetchData = (type, id) => {
	const fetchPromise = responders.fetch.find(cb => cb(type, id));

	if (fetchPromise === undefined) {
		throw new Error('No fetch handler for this type/id combination found');
	}

	return fetchPromise;
};

/**
 * Generates a hook function name, based on the data type.
 * For example, a hook with data type "article" will be called "useArticle".
 * Dots in the type will be replaced by underscore, so "article.comment" will become "useArticle_comment"
 * This is because dynamically created hook functions will be nameless in react devtools
 * if no name is given.
 * @param type
 * @returns {string}
 */
const generateHookName = (type) => {
	const capitalizedType = type.substr(0, 1).toUpperCase() + type.substr(1);
	const sanitizedType = capitalizedType.replace(/\./g, '_');
	return `use${sanitizedType}`;
};

/**
 * Creates a new function that can be used as a hook inside a react component.
 * @param {string} type Identifier for the data type the hook will be handling.
 * @param {string} [hookName] Optional name for the hook function. Will appear in react dev tools.
 * @return {function}
 */
export const createHook = (type, hookName) => {
	/**
	 * The hook function to be used in a react component.
	 * @param {string} id
	 * @returns {array} [*, {loading: true, error: false}, updateFunction(newData):Promise, removeFunction:Promise]
	 */
	const hookFunction = (id) => {
		const dataId = `${type}:${id}`;
		const [, setUpdate] = useState(0);

		useEffect(() => {
			if (!registeredComponents[dataId]) {
				registeredComponents[dataId] = [];
			}
			registeredComponents[dataId].push(setUpdate);
			return () => {
				const index = registeredComponents[dataId].indexOf(setUpdate);
				if (index !== -1) {
					registeredComponents[dataId].splice(index, 1);
				}
			};
		}, [setUpdate]);

		if (hookStore[dataId]) {
			return hookStore[dataId];
		}

		const fetchedData = fetchData(type, id);

		const hookData = [
			/**
			 * Initial data, before anything was fetched is `null`.
			 * Will be updated after the fetch, or when data gets updated through `updateData()`
			 */
			(fetchedData instanceof Promise) ? null : fetchedData,
			/**
			 * Loading indicator to be used inside the react component to show that data
			 */
			{loading: (fetchedData instanceof Promise), error: false},
			/**
			 * Calling this function triggers an update request.
			 * @param {*} newData
			 * @returns {Promise<any>}
			 */
				(newData) => new Promise((resolve, reject) => {
				const updatePromise = responders.update.find(cb => cb(type, id, newData));

				if (updatePromise === undefined) {
					throw new Error('No update handler for this type/id combination found.');
				}

				updatePromise.then(resolve).catch(reject);
			}),
			/**
			 * Calling this function triggers a remove request.
			 * @returns {Promise<any>}
			 */
				() => new Promise((resolve, reject) => {
				const removePromise = responders.remove.find(cb => cb(type, id));

				if (removePromise === undefined) {
					throw new Error('No remove handler for this type/id combination found.');
				}

				removePromise.then(resolve).catch(reject);
			})
		];

		hookStore[dataId] = hookData;

		return hookData;
	};

	Object.defineProperty(hookFunction, 'name', {value: hookName || generateHookName(type)});

	return hookFunction;
};

/**
 * Registers a function that can act as a responder to requests of a certain data
 * type. The callback function should accept two arguments: the type of data that is being
 * asked for and the id, that identifies the data object in question.
 *
 * Multiple responders may be registered. If a responder can handle a certain data/id combination,
 * it needs to return a promise that is eventually fulfilled with the requested data object, or
 * rejected if the data object could not be retrieved. If the data is already at hand, it might be
 * returned immediately without including a promise.
 *
 * If the responder function cannot handle the data/id combination, it should return nothing
 * so the next responder will be asked for the data.
 * @param {function} callback(type, id)
 */
export const registerFetchResponder = (callback) => responders.fetch.push(callback);

/**
 * Registers a function that can act as a responder to update requests. The callback function
 * should accept three arguments: the type of data, an identifier and the new data that should
 * replace the old.
 *
 * Multiple responders may be registered. If a responder can handle a certain data/id combination,
 * it needs to return a promise that is eventually fulfilled with the updated data object, or
 * rejected if the update could not be made. In case of a rejection, the rejection will be forwarded
 * to the hooks update function.
 *
 * If the responder function cannot handle the data/id combination, it should return nothing, so the
 * next responder will be asked to perform the action.
 * @param {function} callback(type, id, data)
 */
export const registerUpdateResponder = (callback) => responders.update.push(callback);

/**
 * Registers a function that can act as a responder to an remove request. The callback function
 * should accept two parameters: the data type and an identifier.
 * @param {function} callback(type, id)
 * @returns {number}
 */
export const registerRemoveResponder = (callback) => responders.remove.push(callback);

/**
 * This function needs to be called from the outside, when a certain type/id combinations data
 * has been changed. If called, all components that are currently registered to this combination
 * will be updated.
 * @param {string} type
 * @param {string} id
 * @param {*} data
 */
export const updateData = (type, id, data) => {
	const dataId = `${type}:${id}`;
	const hookData = hookStore[dataId];

	if (!hookData) {
		return;
	}

	hookData[0] = data;
	updateComponents(dataId);
};

/**
 * Signals that a given data entity for this type/id combination has been removed.
 * @param type
 * @param id
 */
export const removeData = (type, id) => {};
