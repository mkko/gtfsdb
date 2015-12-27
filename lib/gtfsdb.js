// The database abstraction layer

'use strict';

var Promise = require('bluebird');
var downloadGTFS = require('./download');
var _ = require('underscore');

function GTFSdb(knex) {
    
  this._knex = knex;
};

GTFSdb.prototype.download = function download(config, callback) {
  var knex = this._knex;
  return new Promise(function(fulfill, reject) {
    downloadGTFS(knex, config, function(error){
      if (error) reject(error)
      else fulfill();
    });
  });
}

GTFSdb.prototype.getAllAgencies = function getAgencies() {
  return this._knex.select(agencyCols).table('agency_entry')
  .join('agency', 'agency_entry.id', '=', 'agency.agency_entry_id')
  .map(formatAgency);
}

GTFSdb.prototype.getAgencies = function getAgencies(agencyKey) {
  return this._knex.select(agencyCols).from('agency')
  .where('agency_entry_id', getAgencyId(this._knex, agencyKey))
  .map(function (row) {
    // Attach the agency key.
    row.agency_key = agencyKey;
    return row;
  })
  .map(formatRow);
}

GTFSdb.prototype.getStops = function getStops(agencyKey) {
  return this._knex.select(stopCols).from('stop')
  .where('agency_entry_id', getAgencyId(this._knex, agencyKey))
  .map(formatRow);
}

GTFSdb.prototype.getStop = function getStop(agencyKey, stopId) {
  return this._knex.select(stopCols).from('stop')
  .where({
    stop_id: stopId,
    agency_entry_id: getAgencyId(this._knex, agencyKey)
  })
  .then(function(rows) {
    // There should be only one.
    if (rows.length == 0) {
      return Promise.reject('No such stop ID: '+ stopId);
    } else {
      return formatRow(rows[0]);
    }
  });
}

GTFSdb.prototype.getRoutes = function getRoutes(agencyKey) {
  return this._knex.select(routeCols).from('route')
  .where('route.agency_entry_id', getAgencyId(this._knex, agencyKey))
  .leftJoin('agency', 'agency.id', 'route.agency_id');
}

GTFSdb.prototype.getRoute = function getRoute(agencyKey, routeId) {
  return this._knex.select(routeCols).from('route')
  .where({
    'route.route_id': routeId,
    'route.agency_entry_id': getAgencyId(this._knex, agencyKey)
  })
  .leftJoin('agency', 'agency.id', 'route.agency_id')
  .map(formatRow);
}

GTFSdb.prototype.getRouteTrips = function getRouteTrips(agencyKey, routeId) {
  var knex = this._knex;
  return knex.select(tripCols).from('trip').where({
    'trip.agency_entry_id': getAgencyId(knex, agencyKey),
    'trip.route_id': knex.select('id').from('route').where({
      'route.route_id': routeId,
      'route.agency_entry_id': getAgencyId(this._knex, agencyKey)
    })
  }).then(function (trips) {
    
    return Promise.props({
      trips: trips,
      shapes: getShapeSequences(knex, trips),
      stops: getStops(knex, trips)
    });
  }).then(function (data) {
    
    return Promise.props({
      trips: Promise.map(data.trips, function (trip) {
        trip.stop_times = data.stops[trip.id];
        trip.id = undefined;
        // FIXME: Get the stop_id, NOT the database ID
        return trip;
      }),
      shapes: data.shapes
    })
  })
  .map(formatRow);
}

GTFSdb.prototype.getStopTimes = function getStopTimes(agencyKey, stopId) {
  var knex = this._knex;
  return this.getStop(agencyKey, stopId)
  .then(function(stop) {
    return knex.select(stopTimesCols).from('stop_time')
    .where({
      stop_id: stop.id,
      agency_entry_id: getAgencyId(knex, agencyKey)
    });
  })
  .map(formatRow);
}

// Default columns

var agencyCols = [
  'agency.id',
  'agency.agency_id',
  'agency.agency_name',
  'agency.agency_url',
  'agency.agency_timezone',
  'agency.agency_lang',
  'agency.agency_phone',
  'agency.agency_fare_url',
  'agency.last_update'
];

var stopCols = [
  'stop.id',
  'stop.stop_id',
  'stop.stop_code',
  'stop.stop_name',
  'stop.stop_desc',
  'stop.stop_lat',
  'stop.stop_lon',
  'stop.zone_id',
  'stop.stop_url',
  'stop.location_type',
  'stop.parent_station',
  'stop.stop_timezone',
  'stop.wheelchair_boarding',
  'stop.platform_code'
];

var stopTimesCols = [
  'stop_time.id',
  'stop_time.created_at',
  'stop_time.updated_at',
  'stop_time.trip_id',
  'stop_time.arrival_time',
  'stop_time.departure_time',
  'stop_time.stop_id',
  'stop_time.stop_sequence',
  'stop_time.stop_headsign',
  'stop_time.pickup_type',
  'stop_time.drop_off_type',
  'stop_time.shape_dist_traveled',
  'stop_time.timepoint'
];

var routeCols = [
  'route.id',
  'route.route_id',
  'route.route_short_name',
  'route.route_long_name',
  'route.route_desc',
  'route.route_type',
  'route.route_url',
  'route.route_color',
  'route.route_text_color',
  'agency.agency_id'
];

var tripCols = [
  'trip.id',
  'trip.trip_id',
  'trip.route_id',
  'trip.service_id',
  'trip.trip_headsign',
  'trip.trip_short_name',
  'trip.direction_id',
  'trip.block_id',
  'trip.shape_id',
  'trip.wheelchair_accessible',
  'trip.bikes_allowed'
];

// Helpers

function getAgencyId(knex, agencyKey) {
  return knex.select('id').from('agency_entry')
  .where({ agency_key: agencyKey });
}

function formatAgency(agency) {
  agency.id = undefined;
  agency.agency_entry_id = undefined;
  return formatRow(agency);
}

function formatRow(row) {
  row.created_at = undefined;
  row.updated_at = undefined;
  return row;
}

function getShapeSequences(knex, trips) {
  return knex.select(
    'shape_sequence.shape_id',
    'shape_sequence.shape_pt_lat',
    'shape_sequence.shape_pt_lon',
    'shape_sequence.shape_pt_sequence',
    'shape_sequence.shape_dist_traveled'
  ).from('shape_sequence').whereIn('shape_id', trips.map(function (x) { return x.shape_id; }))
  .then(combineShapes)
}

function getStops(knex, trips) {
  return knex.select(
    'stop_time.trip_id',
    'stop_time.arrival_time',
    'stop_time.departure_time',
    'stop_time.stop_sequence',
    'stop_time.stop_headsign',
    'stop_time.pickup_type',
    'stop_time.drop_off_type',
    'stop_time.shape_dist_traveled',
    'stop_time.timepoint',
    'stop.stop_id'
  ).from('stop_time').whereIn('stop_time.trip_id', trips.map(function (x) { return x.id; }))
  .leftJoin('stop', 'stop.id', 'stop_time.stop_id')
  .then(combineStops);
}

function combineShapes(shapeSequences) {
  
  var dict = shapeSequences.reduce(function (acc, row) {
    var d = acc[row.shape_id];
    if (!d) {
      d = [];
      acc[row.shape_id] = d;
    }
    // Insert sorted.
    var insertPos = d.length;
    for (var i = 0; i < d.length; i++) {
      if (d[i].shape_pt_sequence > row.shape_pt_sequence) {
        insertPos = i;
        break;
      }
    }
    d.splice(i, 0, row);
    return acc;
  }, {});
  
  // Remove redundant information.
  for (var key in dict) {
    var shapes = dict[key];
    dict[key] = shapes.map(function (s) {
      return {
        lat: s.shape_pt_lat,
        lon: s.shape_pt_lon,
        shape_dist_traveled: (s.shape_dist_traveled != null ? s.shape_dist_traveled : undefined)
      };
    });
  }
  return dict;
}

function combineStops(routeStops) {
  var dict = routeStops.reduce(function (acc, row) {
    var d = acc[row.trip_id];
    if (!d) {
      d = [];
      acc[row.trip_id] = d;
    }
    // Insert sorted.
    var insertPos = d.length;
    for (var i = 0; i < d.length; i++) {
      if (d[i].stop_sequence > row.stop_sequence) {
        insertPos = i;
        break;
      }
    }
    d.splice(i, 0, row);
    return acc;
  }, {});
  
  return dict;
}

module.exports = function createGTFSdb(knex) {
  var gtfsdb = new GTFSdb(knex);
  return gtfsdb;
};
