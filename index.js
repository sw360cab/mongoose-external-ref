'use strict';

const getValue = (self,path) => {
  if (self.$op === 'save') return self[path];
  return self.getUpdate().$set[path] || self.getUpdate().$inc[path];
};

/**
 * Verify that for a given schema any saved or updated field which is a Ref ObjectId to
 * another Model and which has a 'strictForeignRef' option in the same field, a corresponding
 * Document exists for the Ref schema
 *
 * @param {Object} schema Schema whose plugin is attached.
 * @param {Array} schema List of Mongoose models loaded.
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
    const isModified = (path) => {
      if (self.$op === 'save') return self.isModified(path) && self[path] !== null;
      return Object.keys(self.getUpdate().$set || []) // update 'op'
        .concat(Object.keys(self.getUpdate().$inc || [])).includes(path);
    }
    let modifiedForeignKeys = foreignKeyFields.filter(isModified);
    // check if new or whether modified fields have a Object ref id
    if (this.isNew || modifiedForeignKeys.length > 0) {
      await Promise.all( modifiedForeignKeys.map(async path => {
        let value = getValue(self,path);
        // check if exist in corresponding Model
        let modelName = schema.paths[path].$isMongooseArray ? 
          schema.paths[path].$embeddedSchemaType.options?.ref : schema.paths[path].options.ref;
        // when ref is a Model itself there is no need for list of Mongoose models
        let model = typeof modelName === 'string' ? models[ modelName ] : modelName;
        if (!model) next(new Error("Model referenced does not exist."));
        if (await model.findById(value) === null) {
            next(new Error(`Invalid reference id to document`));
          //  in model "${model.modelName}"` +
            // ` for path "${path}" of model "${self.constructor.modelName}"`, 400));
        }
      }) );
    }
    next();
  });
}
