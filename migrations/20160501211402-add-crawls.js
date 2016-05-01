var dbm = global.dbm || require('db-migrate');
var type = dbm.dataType;

exports.up = function(db, callback) {
  return db.createTable('crawls', {
    id: { type: 'int', primaryKey: true, autoIncrement: true, notNull: true },
    url: { type: 'string', notNull: true },
  }, callback);
};

exports.down = function(db, callback) {
  return db.dropTable('crawls', callback);
};
