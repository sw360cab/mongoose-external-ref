'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const mongooseExternalRef = require('../');

const {Schema} = mongoose;
const connectionUri = 'mongodb://localhost:27017/mongoose-external-ref';

const mongooseExternalRefPlugin = (schema) => {
  mongooseExternalRef.call(this, schema, mongoose.models);
};

describe('Basic Plugin Test', function() {

  before(done => {
    mongoose.connect(connectionUri, {
      useNewUrlParser: true,
      useFindAndModify: false,
      useCreateIndex: true,
      useUnifiedTopology: true,
    }).catch(done);
    let db = mongoose.connection;
    db.on('error', (err) => {
      done(err);
    })
    db.once('connected', async () => {
      await db.dropDatabase();
      done();
    })
  });

  describe('Model level plugin', function() {
    let Image, Profile;

    // create schemas and apply plugin to Model
    before(done => {
      const imageSchema = new Schema({
        url: String,
      });
      Image = mongoose.model('Image', imageSchema);

      const profileSchema = new Schema({
        username: String,
        image: {type: Schema.Types.ObjectId, ref: Image, strictForeignRef: true }
      });
      profileSchema.plugin(mongooseExternalRef);
      Profile = mongoose.model('Profile', profileSchema);
      done()
    });
  
    it('create items with existing ref', async function() {
      let savedImage = await Image.create({url: "http://example.com/image.jpg"});
      let savedProfile = await Profile.create( {username: "foo", image: savedImage._id} );
      assert(savedProfile != null)
    });
  
    it('fail creating items with unexisting ref', async function() {
      await assert.rejects( Profile.create( {username: "foo", image: mongoose.Types.ObjectId()} ) );
    });

    it('update item with existing ref', async function() {
      let savedImage = await Image.create({url: "http://example.com/image.jpg"});
      let savedImage2 = await Image.create({url: "http://example.com/image2.jpg"});
      let savedProfile = await Profile.create( {username: "foo", image: savedImage._id} );
      return savedProfile.updateOne({$set: {image: savedImage2._id} });
    });

    it('not update item with ref of removed item', async function() {
      let savedImage = await Image.create({url: "http://example.com/image.jpg"});
      let savedProfile = await Profile.create( {username: "foo"});
      await Image.findByIdAndDelete(savedImage._id);
      await assert.rejects( savedProfile.updateOne({$set: {image: savedImage._id}}));
    });

  });

  describe('Model level plugin with Optional Fields', function() {
    let User, Band;
    let singer, bass, drums;

    // apply plugin to single schema
    before(() => {
      const userSchema = new Schema({
        role: String
      });
      User = mongoose.model('User', userSchema);

      const bandSchema = new Schema({
        lead: {type: Schema.Types.ObjectId, ref: 'User'},
        members: [{type: Schema.Types.ObjectId, ref: 'User', strictForeignRef: true }]
      });
      bandSchema.plugin(mongooseExternalRefPlugin);
      Band = mongoose.model('Band', bandSchema);

      return Promise.all( ["singer","bass","drums"].map(player => User.create({role: player})) )
      .then((createdUser) => {
        [singer,bass,drums] = createdUser;
        return Promise.resolve();
      });
    });

    it('create items with existing ref', async function() {
      let savedBand = await Band.create( {lead: singer._id, 
        members: [bass._id, drums._id]
      } );
      assert(savedBand != null);
    });
  
    it('fail creating items with unexisting ref', async function() {
      await assert.rejects( Band.create({
        members: [bass._id, mongoose.Types.ObjectId()]
      }));
    });

    it('not fail creating items with unexisting ref when strict reference is not required', async function() {
      let savedBand = await Band.create( {lead:  mongoose.Types.ObjectId(),
        members: [bass._id, drums._id]
      } );
      assert(savedBand != null);
    });

    it('update item with valid ref', async function() {
      let savedBand = await Band.create( {lead:  mongoose.Types.ObjectId(),
        members: [bass._id]
      } );
      await savedBand.updateOne({$push: {'members': drums._id } }); 
    });

    it('update item with valid ref', async function() {
      let savedBand = await Band.create( {lead:  mongoose.Types.ObjectId(),
        members: [bass._id]
      } );
      await savedBand.updateOne({$push: {'members': drums._id } }); 
    });

    it('not update item with ref of removed item', async function() {
      let savedBand = await Band.create( {lead:  mongoose.Types.ObjectId(),
        members: [bass._id]
      } );
      await User.findByIdAndDelete(drums._id);
      await assert.rejects( savedBand.updateOne({$push: {'members': drums._id } }));
    });

  });

  describe('Global level plugin', function() {
    let Fuel, Engine, Car;

    // apply FIRST Global plugin then create schemas
    before((done) => {
      mongoose.plugin(mongooseExternalRefPlugin);

      const fuelSchema = new Schema({
        octane: Number,
      });
      Fuel = mongoose.model('Fuel', fuelSchema);

      const engineSchema = new Schema({
        brand: String,
        horsepower: Number,
        maxSpeed: Number,
        fuelType: {type: Schema.Types.ObjectId, ref: 'Fuel', strictForeignRef: true },
      });
      Engine = mongoose.model('Engine', engineSchema);

      const carSchema = new Schema({
        name: String,
        engine: {type: Schema.Types.ObjectId, ref: 'Engine', strictForeignRef: true },
      });
      Car = mongoose.model('Car', carSchema);
      done();
    });

    it('fail creating items with unexisting ref', async function() {
      await assert.rejects( Car.create({ engine: mongoose.Types.ObjectId() }) );
    });

    it('create items with existing ref', async function() {
      let savedFuel = await Fuel.create({octane: 98});
      let savedEngine = await Engine.create({brand: "Ferrari", horsepower: 200, 
        maxSpeed: 300, fuelType: savedFuel})
      let savedProfile = await Car.create( {name: "FF", engine: savedEngine._id} );
      assert(savedProfile != null);
    });

  });
});
