var dbm = global.dbm || require('db-migrate');
var type = dbm.dataType;

exports.up = function(db, callback) {
  return db.createTable('crawl_results', {
    id: { type: 'int', primaryKey: true, autoIncrement: true, notNull: true },
    crawl_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'crawl_results_crawl_id_fk',
        table: 'crawls',
        rules: {
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    term: { type: 'string', notNull: true },
    probability: { type: 'decimal', notNull: true }
  }, callback);
};

exports.down = function(db, callback) {
  return db.dropTable('crawl_results', callback);
};
