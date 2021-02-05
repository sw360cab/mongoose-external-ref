'use strict';

/**
 * 
 * @param {String} path Path name of external field 
 * @return Value retrieved
 */
const getExternalFieldSingleValue = function(path) {
  let self = this
  if (this.$op === 'save') return this[path].length ? this[path].map(p => p._id) : this[path];
  return Object.keys(this.getUpdate()).map( (upKey) => self.getUpdate()[upKey][path]);
};

/**
 * Retrieve values of external field, dealing with single values or array of values.
 * In any case an array is returned.
 * 
 * @param {Object} schema Reference schema
 * @param {String} path Path name of external field
 * @return {Array} Array of retrieved value
 */
const getExternalFieldValues = function(schema,path) {
  let  update 
  if (schema.paths[path].$isMongooseArray) {
    // return this[path].map(p => p._id);
    if (this.$op === 'save') return this[path].length ? this[path].map(p => p._id) : this[path];
    update = this.getUpdate();
    return Object.keys(update).map( (upKey) => update[upKey][path]);
  }
  return [getExternalFieldSingleValue.call(this, path)].flat();
};

/**
 * Verify that for a given schema any saved or updated field which is a Ref ObjectId to
 * another Model and which has a 'strictForeignRef' option in the same field, a corresponding
 * Document exists for the Ref schema.
 *
 * @param {Object} schema Schema whose plugin is attached.
 * @param {Array}  models List of Mongoose models loaded.
 */
module.exports = function foreingRefValidator(schema, models){
  // check fields which are external ref id and strictForeignRef parameter is set to true
  const foreignKeyFields = Object.keys(schema.paths).filter( path =>
    (schema.paths[path].instance === "ObjectID" && schema.paths[path].options?.strictForeignRef === true)
    || // array of references
    (schema.paths[path].$isMongooseArray && schema.paths[path].$embeddedSchemaType.instance === "ObjectID" 
    && schema.paths[path].$embeddedSchemaType.options?.strictForeignRef === true)
  );

  // pre-hook to 'save' and 'update'
  schema.pre(['save', 'update', 'updateOne'], async function(next) {
    let self = this;
    let model, modelRef, values;

    let modifiedForeignKeys = foreignKeyFields.filter( (path) => {
      if (self.$op === 'save') return self.isModified(path) && self[path] !== null;
      return Object.keys(self.getUpdate().$set || []) // update 'op'
        .concat(Object.keys(self.getUpdate().$push || []))
        .concat(Object.keys(self.getUpdate().$inc || [])).includes(path);
    });

    // check if new or whether modified fields have a Object ref id
    if (this.isNew || modifiedForeignKeys.length > 0) {
      await Promise.all( modifiedForeignKeys.map( (path) => {
        // check if exists in corresponding Model
        modelRef = schema.paths[path].$isMongooseArray ? 
          schema.paths[path].$embeddedSchemaType.options?.ref : schema.paths[path].options.ref;
        // when ref is a Model itself there is no need for list of Mongoose models
        model = typeof modelRef === 'string' ? models[ modelRef ] : modelRef;
        if (!model) throw new Error("Model referenced does not exist.");
        // retrieve values of external fields
        values = getExternalFieldValues.call(self, schema,path);
        return Promise.all( values.map( async (value) => {
          if (await model.findById(value) === null) {
            throw new Error(`Invalid reference id to document in model` + 
              ` "${typeof modelRef === 'string' ? modelRef : modelRef.modelName}"` +
              ` for path "${path}" of model "${self.constructor.modelName || self.model.modelName}"`);
          }
          return Promise.resolve();
        }))
      }) ).catch((e) => {
        next(e)}
      );
    } // else everything is nice and cleans
    next();
  });
}
