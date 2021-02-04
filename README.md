# Mongoose External Ref

## Installation

    npm install mongoose-external-ref

## Usage

Plugin is applied to any field of a model that is a `ref` and which has been provided with the field `strictForeignRef`.

    const bandSchema = new Schema({
      lead: {type: Schema.Types.ObjectId, ref: 'User', strictForeignRef: true},
      members: [{type: Schema.Types.ObjectId, ref: 'User', strictForeignRef: true}]
    });

### Option 1: `ref` as String

The plugin should have visibility over all `mongoose` models loaded.
So its setup must be something like:

    mongoose.plugin((schema) => { 
      mongooseExternalRef.call(this, schema, mongoose.models) }
    );

Of course the previous is the general case where plugin is GLOBALLY applie, check [here](https://mongoosejs.com/docs/plugins.html#global),
similarly it can be applied at model-level.

### Option 2: `ref` as Model

The minimal reference would work ONLY IF reference in Schema is by Model (and not by String):

    mongoose.plugin(mongooseExternalRef)

and Schema is like:

    const User = mongoose.model('User', new Schema({
      role: String
    }) );

    const bandSchema = new Schema({
      lead: {type: Schema.Types.ObjectId, ref: User, strictForeignRef: true},
      ...
    });

If `ref` property in `lead` property would be expressed as String ('User'), the previous would not have worked and
[Option 2](#Option 2: `ref` as Model) would be the only possibility.

## Reasons behind

Unlikely it may appear, the idea behind this plugin is not to reproduce SQL "Foreign Keys" concept of RDBMSs, which is a nosense in NoSql environments.
However `mongoose` allows to introduce `soft` references by using ObjectIds properties related to other models.
The plugin is aiming to make these references **less** `soft` by informing the application that a broken reference will be left behind.
Whether this information is unwanted or not useful at all, it is enough not adding the property `strictForeignRef` to the field containing a `ref`.
On the other hand where `strictForeignRef` is applied, the error can be catched by application and reported as a warning.
