/**
 * Verify that for a given schema any saved or updated field which is a Ref ObjectId to
 * another Model and which has a 'strictForeignRef' option in the same field, a corresponding
 * Document exists for the Ref schema
 *
 * @param {*} schema 
 */
const foreingRefValidator = function(schema){
  // check fields which are external ref id and strictForeignRef parameter is set to true
  const foreignKeyFields = Object.keys(schema.paths).filter( path =>
    schema.paths[path].instance === "ObjectID" && schema.paths[path].options?.strictForeignRef === true
  );

  schema.pre(['save', 'update'], async function(next) {
    let self = this;
    const isModified = (path) => {
      if (self.$op === 'save') return self.isModified(path);
      return Object.keys(self.getUpdate().$set) // update 'op'
        .concat(Object.keys(self.getUpdate().$inc)).includes(path);
    }
    let modifiedForeignKeys = foreignKeyFields.filter(path => 
      isModified(path) && self[path] != null);
    // check if new or whether modified fields have a Object ref id
    if (this.isNew || modifiedForeignKeys.length > 0) {
      await Promise.all( modifiedForeignKeys.map(async path => {
        // check if exist in corresponding Model
        let modelName = schema.paths[path].options.ref
        let model = mongoose.models[ modelName ];
        if (!model) next(new Error("Model referenced does not exist."));
        if (await model.findById(self[path]) === null) {
          next(new Error(`Invalid reference id to document in model "${modelName}"` +
            ` for path "${path}" of model "${self.constructor.modelName}"`, 400));
        }
      }) );
    }
    next();
  });
}
