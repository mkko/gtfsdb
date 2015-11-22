var stream = require('stream');
var util = require('util');
var events = require("events");

// Maintain backwards compatibility
var Transform = stream.Transform || require('readable-stream').Transform;

function Batch(options) {
  
  // Enable use without new
  if (!(this instanceof Batch)) {
    return new Batch(options);
  }
  
  // init Transform
  Transform.call(this, { objectMode: true });
  
  options = options || {};
  this.batchSize = options.batchSize > 0 ? options.batchSize : 100;
  this.batchCondition = options.batchCondition;
  if (!this.batchCondition) {
    this.batchCondition = function(chunk) {
      return this.currentBatch.length >= this.batchSize;
    };
  }
  this.currentBatch = [];
}
util.inherits(Batch, Transform);

Batch.prototype._transform = function(chunk, enc, cb) {
  if (this.batchCondition(this.currentBatch, chunk)) {
    this.push(this.currentBatch);
    this.currentBatch = [];
  }
  this.currentBatch.push(chunk);
  cb();
};

Batch.prototype._flush = function (cb) {
  if (this.currentBatch.length > 0) {
    this.push(this.currentBatch);
    this.currentBatch = [];
  }
  cb();
};

module.exports = Batch;