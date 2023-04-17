/**
 * Searches for the specified name in the data structure of exported names.
 * The data structure is a pair where the head element is the default export
 * and the tail element is a list of pairs where each pair is a mapping from
 * the exported name to the value being exported. If the lookup name is
 * "default", the default export is returned instead of a named export. If
 * the name does not exist, <code>undefined</code> is returned.
 *
 * @param {pair} exports - The data structure of exported values
 * @param {string} lookup_name - Name to import
 * @returns {value} The value corresponding to the imported name
 */
function __access_export__(exports, lookup_name) {}

/**
 * Searches for the specified name in the data structure of exported names.
 * The data structure is a list of pairs where each pair is a mapping from
 * the exported name to the value being exported. If the name does not exist,
 * <code>undefined</code> is returned.
 *
 * @param {list} named_exports - The data structure of exported names
 * @param {string} lookup_name - Name to import
 * @returns {value} The value corresponding to the imported name
 */
function __access_named_export__(named_exports, lookup_name) {}
