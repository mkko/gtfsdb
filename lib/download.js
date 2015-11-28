// This download script is a heavily modified version from node-gtfs.
// https://github.com/brendannee/node-gtfs/blob/master/scripts/download.js
// 

var async = require('async');
var Promise = require('bluebird');
var exec = require('child_process').exec;
var csv = require('csv');
var fs = require('fs');
var path = require('path');
var request = require('request');
var unzip = require('unzip2');
var Batch = require('./batch');
var Writable = require('stream').Writable;
var expandTilde = require('expand-tilde');
var HashMap = require('hashmap');
var q;

function download(knex, config, callback) {
  var log = (config.verbose === false) ? function() {} : console.log;

  q = async.queue(downloadGTFS, 1);
  
  var batchSize = 200;
  // loop through all agencies specified
  // If the agency_key is a URL, download that GTFS file, otherwise treat
  // it as an agency_key and get file from gtfs-data-exchange.com
  config.agencies.forEach(function(item) {
    var agency = {};

    if (typeof(item) == 'string') {
      agency.agency_key = item;
      agency.agency_url = 'http://www.gtfs-data-exchange.com/agency/' + item + '/latest.zip';
    } else if (item.url) {
      agency.agency_key = item.agency_key;
      agency.agency_url = item.url;
    } else if (item.path) {
      agency.agency_key = item.agency_key;
      agency.path = item.path;
    }

    if (!agency.agency_key) {
      handleError(new Error('No URL or Agency Key or path provided.'));
    }

    q.push(agency);
  });

  q.drain = function(e) {
    if (e) handleError(e);

    log('All agencies completed (' + config.agencies.length + ' total)');
    callback();
  };

  function handleError(error) {
    console.error(error || 'Unknown Error');
    callback(error);
  };

  function downloadGTFS(task, cb) {
    var downloadDir = 'downloads';
    var gtfsDir = 'downloads';
    var agency_key = task.agency_key;
    var agencyEntryId = null;

    log(agency_key + ': Starting');
    
    // TODO: Replace with Bluebird.
    async.series([
      cleanupFiles,
      getFiles,
      handleImport,
      cleanupFiles
    ], function(e, results) {
      if (e) {
        log(agency_key + ': Error: ' + e);
        console.error('Stack:\n', e.stack);
      }
      else log(agency_key + ': Completed');
      cb();
    });

    function cleanupFiles(cb) {
      //remove old downloaded file
      exec((process.platform.match(/^win/) ? 'rmdir /Q /S ' : 'rm -rf ') + downloadDir, function(e) {
        try {
          //create downloads directory
          fs.mkdirSync(downloadDir);
          cb();
        } catch (e) {
          if (e.code == 'EEXIST') {
            cb();
          } else {
            handleError(e);
          }
        }
      });
    }


    function getFiles(cb) {
      if (task.agency_url) {
        downloadFiles(cb);
      } else if (task.path) {
        readFiles(cb);
      }
    }


    function downloadFiles(cb) {
      // do download
      var file_protocol = require('url').parse(task.agency_url).protocol;
      if (file_protocol === 'http:' || file_protocol === 'https:') {
        log(agency_key + ': Downloading');
        request(task.agency_url, processFile).pipe(fs.createWriteStream(downloadDir + '/latest.zip'));

        function processFile(e, response, body) {
          if (response && response.statusCode != 200) {
            cb(new Error('Couldn\'t download files'));
          }
          log(agency_key + ': Download successful');

          fs.createReadStream(downloadDir + '/latest.zip')
            .pipe(unzip.Extract({
              path: downloadDir
            }).on('close', cb))
            .on('error', function(e) {
              log(agency_key + ': Error Unzipping File');
              handleError(e);
            });
        }
      } else {
        if (!fs.existsSync(task.agency_url)) {
          return cb(new Error('File does not exists'));
        }

        fs.createReadStream(task.agency_url)
          .pipe(fs.createWriteStream(downloadDir + '/latest.zip'))
          .on('close', function() {
            fs.createReadStream(downloadDir + '/latest.zip')
              .pipe(unzip.Extract({
                path: downloadDir
              }).on('close', cb))
              .on('error', handleError);
          })
          .on('error', handleError);
      }
    }


    function readFiles(cb) {
      var filePath = expandTilde(task.path);
      if (path.extname(filePath) === '.zip') {
        // local file is zipped
        fs.createReadStream(filePath)
          .pipe(unzip.Extract({
            path: downloadDir
          }).on('close', cb))
          .on('error', handleError);
      } else {
        // local file is unzipped, just read it from there.
        gtfsDir = filePath;
        cb();
      }
    }
    
    

    function handleImport(cb) {
      
      knex.transaction(function(trx) {
        
        return new Promise.resolve()
        .then(function () {
          return removeAgency(trx);
        })
        .then(function() { return importAgencies(trx); })
        .then(function() { return importCalendars(trx); })
        .then(function() { return importCalendarDates(trx); })
        .then(function() { return importStops(trx); })
        .then(function() { return importRoutes(trx); })
        .then(function() { return importShapes(trx); })
        .then(function() { return importTrips(trx); })
        .then(function() { return importStopTimes(trx); })
        // The following optional files are not implemented yet.
        //.then(importFareAttributes),
        //.then(importFareRules),
        //.then(importFeedInfos),
        //.then(importFrequencies),
        //.then(importTransfer)
        ;
      })
      .then(function(inserts) {
        cb();
      })
      .catch(function(error) {
        cb(error);
      });
      
      function removeAgency(trx) {
      
        // Clean up caches.
        cachedTripRefs = new HashMap();
        cachedStopRefs = new HashMap();
        cachedRouteRefs = new HashMap();
        cachedServiceRefs = new HashMap();
        cachedAgencyRefs = new HashMap();
        cachedShapeRefs = new HashMap();
      
        // First get the agency_entry_id.
        return trx('agency_entry').select('id').where({
            agency_key: agency_key
        }).then(function (results) {
          var agencyEntryId = (results[0] != null ? results[0].id : null);
          if (!agencyEntryId) {
            log(agency_key + ': No previous entries')
            return;
          } else {
            log(agency_key + ': Removing previous entries');
            return Promise.resolve(agencyEntryId);
          }
        }).then(function (agencyEntryId) {
          // For optimal performance, clean up the larges data sets separately.
        
          var tablesWithEntryId = ['stop_time', 'stop', 'trip', 'route', 'service'];
        
          return Promise.resolve(tablesWithEntryId)
          .map(function (tableName) {
            log('- Removing '+ tableName);
            return trx(tableName).where({
              agency_entry_id: agencyEntryId
            });
          })
          .then(function (){
            log('- Removing everything else');
            // Everything else should just cascade.
            return trx('agency_entry').where({
              id: agencyEntryId
            }).del()
          });
        });
      }
      
      function readGtfsFile(fileName, batchSize, batchHandler) {
        return new Promise(function (resolve, reject) {
          
          var filepath = path.join(gtfsDir, fileName);
          
          if (!fs.existsSync(filepath)) {
            log(agency_key + ': No ' + fileName + ' file found at ' + gtfsDir);
            return reject('No file: ' + fileName);
          }
          log(agency_key + ': Reading ' + fileName);
          
          // Create a writable stream to get the row batch.
          var ws = Writable({ objectMode: true });
          ws._write = function(rows, enc, next) {
            batchHandler(rows)
            .then(function() {
              // Next batch.
              next();
            })
            .catch(function(err) {
              // Bridge the error.
              reject(err);
            });
          };
          
          var gtfs = fs.createReadStream(filepath)
          .pipe(csv.parse({
            columns: true,
            relax: true,
            skip_empty_lines: true
          }))
          .pipe(Batch({ batchSize: batchSize }))
          .pipe(ws);
          
          gtfs.on('finish', function() {
            resolve();
          });
        });
      }
      
      function asWritable(cb) {
        var ws = Writable({ objectMode: true });
        ws._write = function(chunk, enc, next) {
          cb(chunk, function() {
            next();
          });
        };
        return ws;
      }
      
      function importAgencies(trx) {
        console.time('agencies');
        // First create entry for the agency.
        return trx("agency_entry").insert({ agency_key: agency_key })
        .returning('id')
        .tap(function(id) {
          // Set the global id for all imported data.
          agencyEntryId = id[0];
        })
        .then(function() {
          
          return readGtfsFile('agency.txt', batchSize, function(rows, next) {
            
            return Promise.map(rows, function(row) {
              // Reformat the fields.
              row.agency_entry_id = agencyEntryId;
              
              // agency_id can be null, if only one agency.
              if (rows.length == 1 && row.agency_id == null) {
                row.agency_id = agency_key;
              }
              
              return trx('agency').insert(row)
              .returning('id')
              .tap(function(result) {
                addAgencyRef(row.agency_id, result[0]);
              });
            })
            .tap(next);
            
          });
        });
      }

      function importCalendars(trx) {
        return readGtfsFile('calendar.txt', batchSize, function(rows, next) {

          return Promise.resolve(rows)
          .map(function (row) {
            // Reformat the fields.
            row.monday = toInt(row.monday);
            row.tuesday = toInt(row.tuesday);
            row.wednesday = toInt(row.wednesday);
            row.thursday = toInt(row.thursday);
            row.friday = toInt(row.friday);
            row.saturday = toInt(row.saturday);
            row.sunday = toInt(row.sunday);
    
            row.start_date = toDate(row.start_date);
            row.end_date = toDate(row.end_date);
        
            // Create a service for the calendar entry.
            return trx('service').insert({
              agency_entry_id: agencyEntryId,
              service_id: row.service_id
            })
            .returning('id')
            .tap(function(result) {
              addServiceRef(row.service_id, result[0]);
            })
            .then(function(id) {
              // Set the global id for all imported data.
              row.service_id = id[0];
              return row;
            });
          })
          .then(function(results) {
            return trx('calendar').insert(results)
            .tap(next);
            
          });
        });
      }
      
      function promiseService(service) {
        return trx('service').insert(service)
        .returning('id')
        .tap(function(result) {
          addServiceRef(service.service_id, result[0]);
        })
        .then(function(ids) {
          if (ids != null) {
            return ids[0];
          } else {
            handleError("Could not insert service: " + service);
          }
        });
      }
      
      function importCalendarDates(trx) {
        return readGtfsFile('calendar_dates.txt', batchSize, function(rows, next) {
          
          return Promise.resolve(rows)
          .map(function (row) {
            // Reformat the fields.
            row.exception_type = toInt(row.exception_type);
            row.date = toDate(row.date);
            
            // First try to find existing service.
            return trx('service').select('id').where({
              service_id: row.service_id
            }).then(function (results) {
              if (results.length > 0) {
                row.service_id = results[0].id;
                return row;
              } else {
                // No service, create a new one.
                return promiseService({
                  agency_entry_id: agencyEntryId,
                  service_id: row.service_id
                }).then(function(serviceId) {
                  row.service_id = serviceId;
                  return row;
                });
              }
            });
          })
          .then(function(results) {
            return trx('calendar_date').insert(results)
            .tap(next);
          });
        })
        .catch(function() {
          log(agency_key + ': Skipping calendar_dates.txt')
          return Promise.resolve();
        });
      }

      function importStops(trx) {
        return readGtfsFile('stops.txt', batchSize, function(rows, next) {
          
          return Promise.resolve(rows)
          .map(function(row) {
            row.agency_entry_id = agencyEntryId;
            
            return trx('stop').insert(row)
            .returning('id')
            .tap(function(result) {
              addStopRef(row.stop_id, result[0]);
            });
          })
          .tap(next);
          
        });
      }
      
      function importRoutes(trx) {
        return readGtfsFile('routes.txt', batchSize, function(rows, next) {
          
          return Promise.resolve(rows)
          .map(function (row) {
            // Reformat the fields.
            row.agency_entry_id = agencyEntryId;
            row.route_type = toInt(row.route_type);
            row.agency_id = getAgencyRef(row.agency_id);
            
            return trx('route').insert(row)
            .returning('id')
            .then(function(result) {
              addRouteRef(row.route_id, result[0]);
            });
          })
          .tap(next);
          
        });
      }

      function importFareAttributes(trx) {
        // 'fare_attributes.txt'
      }

      function importFareRules(trx) {
        // 'fare_rules.txt'
      }

      function importFeedInfos(trx) {
        // 'feed_info.txt'
      }

      function importFrequencies(trx) {
        // 'frequencies.txt'
      }

      function importTrips(trx) {
        return readGtfsFile('trips.txt', batchSize, function(rows, next) {
          
          return Promise.resolve(rows)
          .map(function (row) {
            
            // trip_id: string not null
            row.agency_entry_id = agencyEntryId;
            row.route_id = getRouteRef(row.route_id);
            row.service_id = getServiceRef(row.service_id);
            // trip_headsign: string
            // trip_short_name: string
            row.direction_id = toInt(row.direction_id);
            // block_id: string
            row.shape_id = getShapeRef(row.shape_id);
            row.wheelchair_accessible = toInt(row.wheelchair_accessible);
            row.bikes_allowed = toInt(row.bikes_allowed);
            
            return trx('trip').insert(row)
            .returning('id')
            .tap(function (result) {
              addTripRef(row.trip_id, result[0]);
            });
          })
          .tap(next);
          
        });
      }

      function importShapes(trx) {
        return readGtfsFile('shapes.txt', batchSize, function(rows, next) {
          
          // Get the unique shape IDs first.
          var rowsByShapeId = groupByShapeId(rows);
          
          return Promise.resolve(rowsByShapeId)
          .map(function(group) {
            return Promise.props({
              shape_id: getOrCreateShapeRef(group.shape_id, trx),
              rows: group.rows,
            });
          })
          .map(function(group) {
            return Promise.resolve(group.rows)
            .map(function(row){
              return {
                shape_id: group.shape_id,
                shape_pt_lon: toFloat(row.shape_pt_lon),
                shape_pt_lat: toFloat(row.shape_pt_lat),
                shape_pt_sequence: toInt(row.shape_pt_sequence),
                shape_dist_traveled: toFloat(row.shape_dist_traveled)
              };
            })
          })
          .map(function(shape_sequences) {
            return trx('shape_sequence').insert(shape_sequences);
          })
          .tap(next);
          
        })
        .catch(function () {
          log(agency_key + ': Skipping shapes.txt')
          return Promise.resolve();
        });
      }
      
      function importStopTimes(trx) {
        return readGtfsFile('stop_times.txt', batchSize, function(rows, next) {
          
          return Promise.resolve(rows)
          .map(function (row) {
            
            row.agency_entry_id = agencyEntryId;
            row.trip_id = getTripRef(row.trip_id);
            row.stop_id = getStopRef(row.stop_id);
            row.arrival_time = row.arrival_time;
            row.departure_time = row.departure_time;
            row.stop_sequence = toInt(row.stop_sequence);
            row.stop_headsign = row.stop_headsign;
            row.pickup_type = toInt(row.pickup_type);
            row.drop_off_type = toInt(row.drop_off_type);
            row.shape_dist_traveled = toFloat(row.shape_dist_traveled);
            row.timepoint = toInt(row.timepoint);
            
            return row;
          })
          .tap(function(rows) {
            return trx('stop_time').insert(rows);
          })
          .tap(next);
          
        });
      }

      function importTransfers(trx) {
        //processGtfsFile('transfers.txt', cb);
      }
    }
  }

  var cachedTripRefs = new HashMap();
  var cachedStopRefs = new HashMap();
  var cachedRouteRefs = new HashMap();
  var cachedServiceRefs = new HashMap();
  var cachedAgencyRefs = new HashMap();
  var cachedShapeRefs = new HashMap();
  
  function addAgencyRef(id, ref) {
    cachedAgencyRefs.set(id, ref);
  }

  function getAgencyRef(id) {
    var ref = cachedAgencyRefs.get(id);
    if (ref == null) {
      // In case we only have one agency ID, use that.
      var refs = cachedAgencyRefs.values();
      if (refs.length == 1) {
        ref = refs[0];
      } else {
        handleError('Could not determine agency with ID: ' + id);
      }
    }
    
    return ref;
  }
  
  function addTripRef(id, ref) {
    cachedTripRefs.set(id, ref);
  }

  function getTripRef(id) {
    return getRef(cachedTripRefs, id, 'trip');
  }
  
  function addStopRef(id, ref) {
    cachedStopRefs.set(id, ref);
  }

  function getStopRef(id) {
    return getRef(cachedStopRefs, id, 'stop');
  }
  
  function addRouteRef(id, ref) {
    cachedRouteRefs.set(id, ref);
  }

  function getRouteRef(id) {
    return getRef(cachedRouteRefs, id, 'route');
  }
  
  function addServiceRef(id, ref) {
    cachedServiceRefs.set(id, ref);
  }

  function getServiceRef(id) {
    return getRef(cachedServiceRefs, id, 'service');
  }
  
  function getShapeRef(id) {
    // Shape ID can be null.
    if (id == null) return null;
    else return getRef(cachedShapeRefs, id, 'shape');
  }
  
  function getRef(hashMap, id, relation) {
    var ref = hashMap.get(id);
    if (ref == null) {
      handleError('No such ' + relation + ' id: ' + id);
    }
    return ref;
  }
  
  function getOrCreateShapeRef(id, knex) {
    var shapeId = cachedShapeRefs.get(id);
    if (shapeId != null) {
      return Promise.resolve(shapeId);
    } else {
      return knex('shape').insert({ shape_id: id })
      .returning('id')
      .then(function(result) {
        if (result[0]  == null) {
          handleError('No such shape_id: ' + id + '\n' + JSON.stringify(result));
        }
        return result[0];
      })
      .tap(function(shapeRef) {
        cachedShapeRefs.set(id, shapeRef);
      });
    }
  }
}


module.exports = download;

// Helpers

function toInt(value) {
  var ret = parseInt(value);
  return isNaN(ret) ? null : ret;
}

function toFloat(value) {
  var ret = parseFloat(value);
  var result = isNaN(ret) ? null : ret;
  return result;
}

function toDate(str) {
  // Eg. 20160831
  var y = str.substring(0,4);
  var m = str.substring(4,6);
  var d = str.substring(6,8);
  return new Date(y, m, d);
}

function groupByShapeId(rows) {
  var dict = rows.reduce(function (acc, row) {
    var d = acc[row.shape_id];
    if (!d) {
      d = [];
      acc[row.shape_id] = d;
    }
    d.push(row);
    return acc;
  }, {});
  
  // Make it an array.
  var result = [];
  for (var key in dict) {
    result.push({
      shape_id: key,
      rows: dict[key]
    });
  }
  return result;
}
